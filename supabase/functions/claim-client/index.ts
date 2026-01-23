import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Normaliza documento para apenas dígitos
function normalizeDocument(doc: string): string {
  return doc.replace(/[^0-9]/g, "");
}

// Resposta genérica para não revelar se CPF existe
function genericErrorResponse(message = "Não foi possível processar a solicitação") {
  return new Response(
    JSON.stringify({ success: false, message }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  console.log("claim-client function called, method:", req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, message: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 1. Validar autenticação do usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("No valid authorization header");
      return new Response(
        JSON.stringify({ success: false, message: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cliente com token do usuário para validar JWT
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ success: false, message: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log("User authenticated:", userId);

    // 2. Parse e validação do body
    const body = await req.json();
    const { cpf, secondFactor } = body;

    if (!cpf || typeof cpf !== "string") {
      return genericErrorResponse("CPF é obrigatório");
    }

    if (!secondFactor || typeof secondFactor !== "string") {
      return genericErrorResponse("Segundo fator de validação é obrigatório");
    }

    const normalizedCpf = normalizeDocument(cpf);
    
    // Validação básica de CPF (11 dígitos) ou CNPJ (14 dígitos)
    if (normalizedCpf.length !== 11 && normalizedCpf.length !== 14) {
      return genericErrorResponse("Documento inválido");
    }

    console.log("Processing claim for document (masked):", normalizedCpf.substring(0, 3) + "***");

    // 3. Cliente com Service Role para operações privilegiadas
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 4. Buscar cliente pelo documento normalizado
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, name, portal_user_id, phone")
      .eq("document_normalized", normalizedCpf)
      .maybeSingle();

    if (clientError) {
      console.error("Client lookup error:", clientError);
      return genericErrorResponse();
    }

    // Resposta genérica se não encontrar (não revelar se CPF existe)
    if (!client) {
      console.log("Client not found for document");
      // Delay artificial para dificultar timing attacks
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
      return genericErrorResponse("Dados não conferem. Verifique as informações.");
    }

    console.log("Client found:", client.id, "phone:", client.phone ? "***" + client.phone.slice(-4) : "none");

    // 5. Validar segundo fator
    // Regra inicial simples: comparar com os últimos 4 dígitos do telefone
    const phoneDigits = client.phone ? normalizeDocument(client.phone).slice(-4) : "";
    const secondFactorNormalized = normalizeDocument(secondFactor);

    console.log("Comparing second factor:", secondFactorNormalized, "with phone digits:", phoneDigits);

    const isSecondFactorValid = phoneDigits.length >= 4 && secondFactorNormalized === phoneDigits;

    if (!isSecondFactorValid) {
      console.log("Second factor validation failed");
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
      return genericErrorResponse("Dados não conferem. Verifique as informações.");
    }

    // 6. Verificar se já está vinculado a outro usuário
    if (client.portal_user_id && client.portal_user_id !== userId) {
      console.log("Client already linked to another user");
      return genericErrorResponse("Este cadastro já está vinculado a outro usuário.");
    }

    // 7. Verificar se usuário já está vinculado a outro cliente
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("client_id")
      .eq("id", userId)
      .maybeSingle();

    if (existingProfile?.client_id && existingProfile.client_id !== client.id) {
      console.log("User already linked to another client");
      return genericErrorResponse("Sua conta já está vinculada a outro cadastro.");
    }

    // 8. Realizar vinculação
    console.log("Linking user", userId, "to client", client.id);

    // Atualizar clients.portal_user_id
    const { error: updateClientError } = await supabaseAdmin
      .from("clients")
      .update({ portal_user_id: userId })
      .eq("id", client.id);

    if (updateClientError) {
      console.error("Error updating client:", updateClientError);
      return genericErrorResponse("Erro ao processar vinculação.");
    }

    // Atualizar ou criar profile
    const { error: upsertProfileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        client_id: client.id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "id",
      });

    if (upsertProfileError) {
      console.error("Error upserting profile:", upsertProfileError);
      // Rollback: remover portal_user_id do client
      await supabaseAdmin
        .from("clients")
        .update({ portal_user_id: null })
        .eq("id", client.id);
      return genericErrorResponse("Erro ao processar vinculação.");
    }

    // Garantir que user tem role CLIENT em user_roles
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: userId,
        role: "client",
      }, {
        onConflict: "user_id,role",
        ignoreDuplicates: true,
      });

    if (roleError) {
      console.error("Error upserting user_role:", roleError);
      // Não falha a operação por isso
    }

    console.log("Claim successful for client:", client.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Vinculação realizada com sucesso!",
        clientName: client.name,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return genericErrorResponse("Erro interno do servidor.");
  }
});
