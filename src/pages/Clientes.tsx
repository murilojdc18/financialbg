import { useState, useMemo } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Loader2 } from "lucide-react";
import { DbClient, DbClientInsert, DbClientUpdate } from "@/types/database";
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from "@/hooks/useClients";
import { ClientsTable } from "@/components/clients/ClientsTable";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { DeleteClientDialog } from "@/components/clients/DeleteClientDialog";
import { EmptyClientsState } from "@/components/clients/EmptyClientsState";

export default function Clientes() {
  const { data: clients = [], isLoading, error } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<DbClient | null>(null);

  // Filter clients by search term
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    
    const term = searchTerm.toLowerCase();
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(term) ||
        (client.document && client.document.toLowerCase().includes(term))
    );
  }, [clients, searchTerm]);

  const handleAddClient = () => {
    setSelectedClient(null);
    setIsFormOpen(true);
  };

  const handleEditClient = (client: DbClient) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };

  const handleDeleteClient = (client: DbClient) => {
    setSelectedClient(client);
    setIsDeleteOpen(true);
  };

  const handleFormSubmit = async (data: DbClientInsert) => {
    if (selectedClient) {
      await updateClient.mutateAsync({ id: selectedClient.id, ...data });
    } else {
      await createClient.mutateAsync(data);
    }
    setIsFormOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (selectedClient) {
      await deleteClient.mutateAsync(selectedClient.id);
      setIsDeleteOpen(false);
      setSelectedClient(null);
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Clientes" description="Carregando...">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="Clientes" description="Erro ao carregar">
        <div className="text-center py-16 text-destructive">
          Erro ao carregar clientes: {error.message}
        </div>
      </PageContainer>
    );
  }

  const hasClients = clients.length > 0;
  const hasFilteredClients = filteredClients.length > 0;

  return (
    <PageContainer
      title="Clientes"
      description="Gerencie sua base de clientes, visualize histórico e informações de contato."
    >
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleAddClient}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Content */}
      {!hasClients || !hasFilteredClients ? (
        <EmptyClientsState
          onAddClient={handleAddClient}
          hasSearch={!!searchTerm.trim()}
        />
      ) : (
        <ClientsTable
          clients={filteredClients}
          onEdit={handleEditClient}
          onDelete={handleDeleteClient}
        />
      )}

      {/* Dialogs */}
      <ClientFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        client={selectedClient}
        onSubmit={handleFormSubmit}
        isLoading={createClient.isPending || updateClient.isPending}
      />

      <DeleteClientDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        client={selectedClient}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteClient.isPending}
      />
    </PageContainer>
  );
}
