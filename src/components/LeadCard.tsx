import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LeadCardProps {
  name: string;
  email?: string;
  mobile?: string;
  leadStatus?: string;
  referenceNo?: string;
  className?: string;
  //type?: string; // LEAD / PROSPECT / CUSTOMER
  pipelineName?: string;
  stageName?: string;
  statusName?: string;
}

export const LeadCard = ({ name, email, mobile, leadStatus, referenceNo, pipelineName, stageName, statusName, className }: LeadCardProps) => {
  return (
    <Card className={cn("mt-1", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{name}</span>
          {leadStatus && <Badge variant="secondary">{leadStatus}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {email && <p className="text-sm text-muted-foreground">Email: {email}</p>}
        {mobile && <p className="text-sm text-muted-foreground">Mobile: {mobile}</p>}
        {referenceNo && <p className="text-sm text-muted-foreground">Reference: {referenceNo}</p>}

        {/* Pipeline Info */}
        {pipelineName && (
          <p className="text-muted-foreground">
            Pipeline: <span className="text-foreground">{pipelineName}</span>
          </p>
        )}

        {stageName && (
          <p className="text-muted-foreground">
            Stage: <span className="text-foreground">{stageName}</span>
          </p>
        )}

        {statusName && (
          <p className="text-muted-foreground">
            Status: <span className="text-foreground">{statusName}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
};
