import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getBusinessId } from "@/config";

interface Pipeline {
  id: string;
  name: string;
}

interface CreatePipelineModalProps {
  open: boolean;
  onCreate: (pipeline: Pipeline) => void;
  onClose: () => void;
}

async function fetchBusinessById(businessId: string) {
  const response = await fetch(
    `https://stage-api.simpo.ai/business/business/getById?businessId=${businessId}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch business details");
  }

  return response.json();
}


export default function CreatePipelineModal({
  open,
  onCreate,
  onClose,
}: CreatePipelineModalProps) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

    const handleCreate = async () => {
    if (!name.trim()) {
      setError("Pipeline name is required");
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
        const businessId = getBusinessId();
        const business = await fetchBusinessById(businessId);
        const businessName =
        business?.name ||
        business?.legalBusinessName ||
        "Business";

      const response = await fetch(
        "https://stage-api.simpo.ai/crm/pipeline",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            business:{
                id:businessId,
                name:businessName,
            },
            name: name.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create pipeline");
      }

      const result = await response.json();
      const pipeline = result?.data;

      // Send only what parent needs
      onCreate({
        id: pipeline.id,
        name: pipeline.name,
      });

      setName("");
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Pipeline</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Label>Pipeline Name</Label>
          <Input
            autoFocus
            placeholder="e.g. Sales Pipeline"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
