import { createClient } from "npm:@supabase/supabase-js@2";

// Allowed origins for CORS - restrict to known domains
const allowedOrigins = [
  'https://financialbg.lovable.app',
  'https://id-preview--7f360290-8514-4e33-a842-b25c44a243a7.lovable.app',
  'https://lipvstajrfjjxddtypnv.supabase.co',
  // Development origins
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

// Rate limiting configuration
const RATE_LIMIT_MAX_ATTEMPTS = 5; // Max attempts per hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && allowedOrigins.includes(origin) 
    ? origin 
    : allowedOrigins[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Normaliza documento para apenas dígitos
function normalizeDocument(doc: string): string {
  return doc.replace(/[^0-9]/g, "");
}

// Resposta genérica para não revelar se CPF existe
function genericErrorResponse(corsHeaders: Record<string, string>, message = "Não foi possível processar a solicitação") {
  return new Response(
    JSON.stringify({ success: false, message }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  
  console.log("claim-client function called, method:", req.method, "origin:", origin);

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

    // 2. Cliente com Service Role para operações privilegiadas
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 3. Rate limiting check - count attempts in last hour
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count: attemptCount, error: countError } = await supabaseAdmin
      .from("claim_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("attempted_at", oneHourAgo);

    if (countError) {
      console.error("Error checking rate limit:", countError);
      // Continue with caution - don't block legitimate users due to DB issues
    } else if (attemptCount !== null && attemptCount >= RATE_LIMIT_MAX_ATTEMPTS) {
      console.log("Rate limit exceeded for user:", userId, "attempts:", attemptCount);
      // Add delay to slow down automated attacks
      await new Promise(resolve => setTimeout(resolve, 2000));
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Muitas tentativas. Aguarde uma hora antes de tentar novamente." 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Log this attempt FIRST (before any validation to prevent timing enumeration)
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";
    
    const { error: insertAttemptError } = await supabaseAdmin
      .from("claim_attempts")
      .insert({ 
        user_id: userId, 
        ip_address: clientIp 
      });

    if (insertAttemptError) {
      console.error("Error logging attempt:", insertAttemptError);
      // Continue - don't block user due to logging issues
    }

    // Generate unique request ID for logging (avoids logging sensitive data)
    const requestId = crypto.randomUUID().slice(0, 8);
    
    // Fixed timing delay for ALL validation paths to prevent enumeration
    const FIXED_DELAY_MS = 800;
    const startTime = Date.now();
    
    // Helper for consistent timing delays on ALL error paths
    const delayedError = async (message: string) => {
      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(FIXED_DELAY_MS - elapsed, 0) + Math.random() * 200;
      await new Promise(resolve => setTimeout(resolve, remainingDelay));
      return genericErrorResponse(corsHeaders, message);
    };

    // 5. Parse e validação do body with proper error handling
    let cpf: string;
    let secondFactor: string;
    
    try {
      const body = await req.json();
      cpf = body.cpf;
      secondFactor = body.secondFactor;
    } catch (parseError) {
      console.error(`[${requestId}] Invalid JSON body`);
      return delayedError("Requisição inválida");
    }

    if (!cpf || typeof cpf !== "string") {
      return delayedError("CPF é obrigatório");
    }

    if (!secondFactor || typeof secondFactor !== "string") {
      return delayedError("Segundo fator de validação é obrigatório");
    }

    const normalizedCpf = normalizeDocument(cpf);
    
    // Validação básica de CPF (11 dígitos) ou CNPJ (14 dígitos)
    // Note: we always query the DB regardless of format to prevent timing leakage
    const isValidFormat = normalizedCpf.length === 11 || normalizedCpf.length === 14;

    console.log(`[${requestId}] Processing claim request`);

    // 6. Always query the database to ensure consistent timing
    // Query even for invalid formats to prevent timing-based format detection
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, name, portal_user_id, phone")
      .eq("document_normalized", isValidFormat ? normalizedCpf : "INVALID_FORMAT_QUERY")
      .maybeSingle();

    if (clientError) {
      console.error(`[${requestId}] Client lookup error:`, clientError.code);
      return delayedError("Não foi possível processar a solicitação");
    }

    // Return format error after DB query to maintain consistent timing
    if (!isValidFormat) {
      return delayedError("Documento inválido");
    }

    // Resposta genérica se não encontrar (não revelar se CPF existe)
    if (!client) {
      console.log(`[${requestId}] Validation failed`);
      return delayedError("Dados não conferem. Verifique as informações.");
    }

    console.log(`[${requestId}] Client found`);

    // 7. Validar segundo fator
    // Regra: comparar com os últimos 4 dígitos do telefone
    const phoneDigits = client.phone ? normalizeDocument(client.phone).slice(-4) : "";
    const secondFactorNormalized = normalizeDocument(secondFactor);

    const isSecondFactorValid = phoneDigits.length >= 4 && secondFactorNormalized === phoneDigits;

    if (!isSecondFactorValid) {
      console.log(`[${requestId}] Validation failed`);
      return delayedError("Dados não conferem. Verifique as informações.");
    }

    // 8. Verificar se já está vinculado a outro usuário
    if (client.portal_user_id && client.portal_user_id !== userId) {
      console.log(`[${requestId}] Client already linked to another user`);
      return genericErrorResponse(corsHeaders, "Este cadastro já está vinculado a outro usuário.");
    }

    // 9. Verificar se usuário já está vinculado a outro cliente
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("client_id")
      .eq("id", userId)
      .maybeSingle();

    if (existingProfile?.client_id && existingProfile.client_id !== client.id) {
      console.log(`[${requestId}] User already linked to another client`);
      return genericErrorResponse(corsHeaders, "Sua conta já está vinculada a outro cadastro.");
    }

    // 10. Realizar vinculação
    console.log(`[${requestId}] Linking user to client`);

    // Atualizar clients.portal_user_id
    const { error: updateClientError } = await supabaseAdmin
      .from("clients")
      .update({ portal_user_id: userId })
      .eq("id", client.id);

    if (updateClientError) {
      console.error(`[${requestId}] Error updating client:`, updateClientError.code);
      return genericErrorResponse(corsHeaders, "Erro ao processar vinculação.");
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
      console.error(`[${requestId}] Error upserting profile:`, upsertProfileError.code);
      // Rollback: remover portal_user_id do client
      await supabaseAdmin
        .from("clients")
        .update({ portal_user_id: null })
        .eq("id", client.id);
      return genericErrorResponse(corsHeaders, "Erro ao processar vinculação.");
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
      console.error(`[${requestId}] Error upserting user_role:`, roleError.code);
      // Não falha a operação por isso
    }

    // 11. Clean up old attempts (best effort - run periodically)
    try {
      await supabaseAdmin.rpc("cleanup_old_claim_attempts");
    } catch (cleanupError) {
      // Cleanup is best-effort, don't log details
    }

    console.log(`[${requestId}] Claim successful`);

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
    return genericErrorResponse(corsHeaders, "Erro interno do servidor.");
  }
});
