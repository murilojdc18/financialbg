import { useState, useMemo } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { Client, ClientFormData } from "@/types/client";
import { initialMockClients } from "@/data/mock-clients";
import { ClientsTable } from "@/components/clients/ClientsTable";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { DeleteClientDialog } from "@/components/clients/DeleteClientDialog";
import { EmptyClientsState } from "@/components/clients/EmptyClientsState";
import { useToast } from "@/hooks/use-toast";

export default function Clientes() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>(initialMockClients);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

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

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };

  const handleDeleteClient = (client: Client) => {
    setSelectedClient(client);
    setIsDeleteOpen(true);
  };

  const handleFormSubmit = (data: ClientFormData) => {
    if (selectedClient) {
      // Edit existing client
      setClients((prev) =>
        prev.map((c) =>
          c.id === selectedClient.id
            ? { ...c, ...data, updatedAt: new Date() }
            : c
        )
      );
      toast({
        title: "Cliente atualizado",
        description: `${data.name} foi atualizado com sucesso.`,
      });
    } else {
      // Add new client
      const newClient: Client = {
        id: Date.now().toString(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setClients((prev) => [newClient, ...prev]);
      toast({
        title: "Cliente cadastrado",
        description: `${data.name} foi adicionado com sucesso.`,
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedClient) {
      setClients((prev) => prev.filter((c) => c.id !== selectedClient.id));
      toast({
        title: "Cliente excluído",
        description: `${selectedClient.name} foi removido.`,
      });
      setIsDeleteOpen(false);
      setSelectedClient(null);
    }
  };

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
      />

      <DeleteClientDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        client={selectedClient}
        onConfirm={handleDeleteConfirm}
      />
    </PageContainer>
  );
}
