import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Upload, ChevronDown, ChevronRight, Check, Trash2, Building2, MapPin, Phone, Mail, Globe, Star, Users, ExternalLink, Download, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { API_BASE_URL, getBusinessId, getMemberId } from "@/config";
import CreatePipelineModal from "@/components/CreatePipelineModal";


interface Lead {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  url?: string;
  geo?: string;
  rating?: number;
  total_reviews?: number;
  source?: string;
  [key: string]: any; // Allow additional fields
}

interface Pipeline {
  id: string;
  name: string;
  description?: string;
}

interface LeadImportModalProps {
  open: boolean;
  onClose: () => void;
  leads: Lead[];
  businessType?: string;
  location?: string;
  downloadUrl?: string;
  onImport: (leads: Lead[], pipelineId: string) => void;
  isImporting?: boolean;
}

export function LeadImportModal({
                                  open,
                                  onClose,
                                  leads: initialLeads,
                                  businessType,
                                  location,
                                  downloadUrl,
                                  onImport,
                                  isImporting: initialIsImporting = false
                                }: LeadImportModalProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedPipelines, setSelectedPipelines] = useState<Record<number, string>>({});
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isLoadingPipelines, setIsLoadingPipelines] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showCreatePipeline, setShowCreatePipeline] = useState(false);
  const [currentPipelineIndex, setCurrentPipelineIndex] = useState<number | null>(null);

  // Step & Mapping State
  const [step, setStep] = useState<1 | 2>(1);
  const [csvFields, setCsvFields] = useState<string[]>([]);
  const [dbFields, setDbFields] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [isLoadingHeaders, setIsLoadingHeaders] = useState(false);
  const [isImporting, setIsImporting] = useState(initialIsImporting);

  const normalizePhone = (phone?: string) =>
      phone ? phone.replace(/\s+/g, "") : "";

  // Fetch pipelines from API
  useEffect(() => {
    if (open) {
      fetchPipelines();
      setStep(1); // Reset step on open
      setImportStatus(null);
    }
  }, [open]);

  // Reset state when leads change
  useEffect(() => {
    const normalizedLeads = initialLeads.map((lead) => ({
      ...lead,
      phone: normalizePhone(lead.phone),
    }));
    setLeads(normalizedLeads);
    setSelectedPipelines({});
    setExpandedIndices(new Set());
  }, [initialLeads]);

  useEffect(() => {
    if (pipelines.length > 0 && leads.length > 0) {
      setSelectedPipelines((prev) => {
        // Do NOT override user selections
        if (Object.keys(prev).length > 0) return prev;

        const defaults: Record<number, string> = {};
        const firstPipelineId = pipelines[0].id;

        leads.forEach((_, index) => {
          defaults[index] = firstPipelineId;
        });

        return defaults;
      });
    }
  }, [pipelines, leads]);

  const fetchPipelines = async () => {
    setIsLoadingPipelines(true);
    try {
      const businessId = getBusinessId();

      const response = await fetch(
          `https://stage-api.simpo.ai/crm/pipeline/${businessId}/pipelines`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${localStorage.getItem("token")}`,
              "Accept": "application/json",
            },
          }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch pipelines");
      }

      const result = await response.json();
      const pipelines = result?.data || [];
      setPipelines(pipelines);
      if (pipelines.length === 0) {
        setShowCreatePipeline(true);
      }
    } catch (error) {
      console.error("Pipeline fetch error:", error);
      setPipelines([]);
      setShowCreatePipeline(true);
    } finally {
      setIsLoadingPipelines(false);
    }
  };

  const handleFieldChange = (index: number, field: keyof Lead, value: string) => {
    const updated = [...leads];
    updated[index] = { ...updated[index], [field]: value };
    setLeads(updated);
  };

  const handlePipelineChange = (index: number, pipelineId: string) => {
    setSelectedPipelines(prev => ({
      ...prev,
      [index]: pipelineId
    }));
  };

  const handleRemoveLead = (index: number) => {
    const newLeads = leads.filter((_, i) => i !== index);
    setLeads(newLeads);

    // Update expanded indices
    const newExpanded = new Set<number>();
    expandedIndices.forEach(i => {
      if (i < index) newExpanded.add(i);
      else if (i > index) newExpanded.add(i - 1);
    });
    setExpandedIndices(newExpanded);

    // Update selected pipelines
    const newPipelines: Record<number, string> = {};
    Object.entries(selectedPipelines).forEach(([idx, pipelineId]) => {
      const numIdx = parseInt(idx);
      if (numIdx < index) newPipelines[numIdx] = pipelineId;
      else if (numIdx > index) newPipelines[numIdx - 1] = pipelineId;
    });
    setSelectedPipelines(newPipelines);
  };

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedIndices);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedIndices(newExpanded);
  };

  // --- Step 1 Logic: Prepare & Fetch Headers ---

  const generateCSV = (data: Lead[], forceHeaders?: string[]): File => {
    // Collect all unique keys from the leads data if headers not forced
    const allKeys = forceHeaders && forceHeaders.length > 0
        ? forceHeaders
        : Array.from(new Set(data.flatMap(Object.keys)));

    const csvRows = [
      allKeys.join(","), // Header row
      ...data.map(row => {
        return allKeys.map(fieldName => {
          const val = row[fieldName] !== undefined ? row[fieldName] : "";
          // Escape quotes and wrap in quotes to handle commas/newlines in data
          const stringVal = String(val).replace(/"/g, '""');
          return `"${stringVal}"`;
        }).join(",");
      })
    ];

    const csvContent = csvRows.join("\n");
    return new File([csvContent], "leads_export.csv", { type: "text/csv" });
  };

  const handleNextStep = async () => {
    // Validate that all leads have pipelines selected
    const leadsWithoutPipeline = leads
        .map((_, index) => index)
        .filter(index => !selectedPipelines[index]);

    if (leadsWithoutPipeline.length > 0) {
      setImportStatus({
        type: 'error',
        message: `Please select a pipeline for all leads (${leadsWithoutPipeline.length} lead(s) missing)`
      });
      return;
    }
    const leadsWithoutPhone = leads
        .map((lead, index) => (!lead.phone ? index : null))
        .filter((i) => i !== null);

    if (leadsWithoutPhone.length > 0) {
      setImportStatus({
        type: "error",
        message: `Please provide phone numbers for all leads (${leadsWithoutPhone.length} missing)`
      });
      return;
    }

    setIsLoadingHeaders(true);
    setImportStatus(null);

    try {
      const file = generateCSV(leads);
      const formData = new FormData();
      formData.append("file", file);

      const businessId = getBusinessId();
      const response = await fetch(`https://stage-api.simpo.ai/crm/leads/get/excel-headers?businessId=${businessId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Accept': 'application/json'
        },
        body: formData
      });

      if (!response.ok) throw new Error("Failed to fetch mapping headers");

      const result = await response.json();
      const { csv_fields, db_fields } = result.data;

      setCsvFields(csv_fields || []);
      setDbFields(db_fields || []);

      // Auto-map logic
      const initialMapping: Record<string, string> = {};
      (csv_fields || []).forEach((csvField: string) => {
        const normalizedCsv = csvField.toLowerCase().replace(/[^a-z0-9]/g, '');

        const match = (db_fields || []).find((dbField: string) => {
          const normalizedDb = dbField.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalizedDb === normalizedCsv ||
              (normalizedCsv === 'name' && normalizedDb === 'personname') ||
              (normalizedCsv === 'phone' && normalizedDb === 'mobilenumber') ||
              (normalizedCsv === 'address' && normalizedDb === 'street') ||
              (normalizedCsv === 'url' && normalizedDb === 'companywebsite') ||
              (normalizedCsv === 'source' && normalizedDb === 'leadsource');
        });

        if (match) {
          initialMapping[csvField] = match;
        }
      });

      setFieldMapping(initialMapping);
      setStep(2);

    } catch (error) {
      console.error(error);
      setImportStatus({ type: 'error', message: "Failed to prepare import step. Please try again." });
    } finally {
      setIsLoadingHeaders(false);
    }
  };

  // --- Step 2 Logic: Final Import ---

  const handleFinalImport = async () => {
    // Group leads by pipeline for efficient import
    const leadsByPipeline: Record<string, { leads: Lead[]; indices: number[] }> = {};

    leads.forEach((lead, index) => {
      const pipelineId = selectedPipelines[index];
      if (!leadsByPipeline[pipelineId]) {
        leadsByPipeline[pipelineId] = { leads: [], indices: [] };
      }
      leadsByPipeline[pipelineId].leads.push(lead);
      leadsByPipeline[pipelineId].indices.push(index);
    });

    setImportStatus({ type: 'info', message: 'Importing leads...' });
    setIsImporting(true);

    try {
      let successCount = 0;
      let failCount = 0;

      // Import each pipeline group
      for (const [pipelineId, { leads: pipelineLeads }] of Object.entries(leadsByPipeline)) {
        try {
          const businessId = getBusinessId();

          // 1. Generate CSV for this specific pipeline group
          // We pass csvFields to ensure the CSV structure matches what was used for mapping in Step 1
          const file = generateCSV(pipelineLeads, csvFields);

          // 2. Construct the mapping JSON (DB Field -> CSV Header)
          const mappingRequest: Record<string, string> = {};

          // Iterate through all available DB fields to ensure the map is complete
          // If a DB field is not mapped, send empty string
          dbFields.forEach(dbField => {
            // Find the CSV header that maps to this DB field
            const mappedCsvHeader = Object.keys(fieldMapping).find(
                key => fieldMapping[key] === dbField
            );
            mappingRequest[dbField] = mappedCsvHeader || "";
          });

          // 3. Prepare FormData and URL
          const formData = new FormData();
          formData.append("file", file);

          const requestParam = encodeURIComponent(JSON.stringify(mappingRequest));

          // Note: moduleType=LEAD is hardcoded
          const url = `https://stage-api.simpo.ai/crm/leads/upload/dynamic-excel?businessId=${businessId}&request=${requestParam}&moduleType=LEAD&pipelineId=${pipelineId}`;

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Accept': 'application/json'
              // Content-Type header is skipped so browser sets it with boundary for FormData
            },
            body: formData
          });

          if (response.ok) {
            successCount += pipelineLeads.length;
          } else {
            failCount += pipelineLeads.length;
            console.error(`Failed to import leads to pipeline ${pipelineId}`);
          }
        } catch (error) {
          console.error(`Error importing to pipeline ${pipelineId}:`, error);
          failCount += pipelineLeads.length;
        }
      }

      if (successCount > 0) {
        setImportStatus({
          type: 'success',
          message: `Successfully imported ${successCount} lead(s)${failCount > 0 ? `, ${failCount} failed` : ''}!`
        });

        // Close modal after 2 seconds on success
        setTimeout(() => {
          onClose();
          setImportStatus(null);
          setIsImporting(false);
        }, 2000);
      } else {
        setImportStatus({
          type: 'error',
          message: `Failed to import leads. Please try again.`
        });
        setIsImporting(false);
      }
    } catch (error) {
      setImportStatus({
        type: 'error',
        message: `Import error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      setIsImporting(false);
    }
  };

  const selectedCount = Object.keys(selectedPipelines).length;
  const canProceed = selectedCount === leads.length && leads.length > 0 && !isImporting && !isLoadingHeaders;

  return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0">
          {/* Header - Fixed */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <DialogTitle className="text-2xl flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-primary" />
                  {step === 1 ? "Import Leads to CRM" : "Map CSV Fields"}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 text-base">
                  {step === 1 ? (
                      businessType && location && (
                          <span className="flex items-center gap-1">
                      <Badge variant="secondary" className="font-normal">
                        {leads.length} {businessType}
                      </Badge>
                      <span className="text-muted-foreground">from</span>
                      <Badge variant="outline" className="font-normal">
                        <MapPin className="h-3 w-3 mr-1" />
                        {location}
                      </Badge>
                    </span>
                      )
                  ) : (
                      <span>Map your CSV columns to the corresponding CRM fields.</span>
                  )}
                </DialogDescription>
              </div>

              {/* Download CSV Button (Only Step 1) */}
              {step === 1 && downloadUrl && (
                  <a
                      href={downloadUrl}
                      download
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download CSV
                  </a>
              )}
            </div>

            {/* Import Status Alert */}
            {importStatus && (
                <Alert className={`mt-4 ${
                    importStatus.type === 'success' ? 'bg-green-50 border-green-200' :
                        importStatus.type === 'error' ? 'bg-red-50 border-red-200' :
                            'bg-blue-50 border-blue-200'
                }`}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="font-medium">
                    {importStatus.message}
                  </AlertDescription>
                </Alert>
            )}
          </DialogHeader>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden px-6">
            {step === 1 ? (
                <>
                  <div className="flex items-center justify-between mb-3 py-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {selectedCount} of {leads.length} leads have pipelines selected
                </span>
                    {selectedCount < leads.length && (
                        <span className="text-xs text-amber-600 font-medium">
                    ⚠️ Select pipeline for all leads to enable import
                  </span>
                    )}
                  </div>

                  <ScrollArea className="h-[calc(90vh-280px)]" ref={scrollAreaRef}>
                    <div className="space-y-3 pr-4 pb-4">
                      {leads.map((lead, index) => (
                          <Collapsible
                              key={index}
                              open={expandedIndices.has(index)}
                              onOpenChange={() => toggleExpand(index)}
                          >
                            <Card className="border-2 hover:border-primary/30 transition-all duration-200">
                              {/* Lead Header - Always Visible */}
                              <CardHeader className="p-4 pb-3">
                                <div className="flex items-start gap-3">
                                  <CollapsibleTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 hover:bg-accent"
                                    >
                                      {expandedIndices.has(index) ? (
                                          <ChevronDown className="h-4 w-4" />
                                      ) : (
                                          <ChevronRight className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </CollapsibleTrigger>

                                  <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline" className="font-mono text-xs">
                                        #{index + 1}
                                      </Badge>
                                      <CardTitle className="text-base font-semibold truncate flex-1 min-w-0">
                                        {lead.name || "Unnamed Lead"}
                                      </CardTitle>
                                      {lead.rating && (
                                          <Badge variant="secondary" className="gap-1">
                                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                            {lead.rating}
                                            {lead.total_reviews && (
                                                <span className="text-muted-foreground">
                                        ({lead.total_reviews})
                                      </span>
                                            )}
                                          </Badge>
                                      )}
                                    </div>

                                    {/* Quick Info Row */}
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                      {lead.phone && (
                                          <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                            {lead.phone}
                                  </span>
                                      )}
                                      {lead.email && (
                                          <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                            {lead.email}
                                  </span>
                                      )}
                                      {lead.address && (
                                          <span className="flex items-center gap-1 truncate max-w-xs">
                                    <MapPin className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{lead.address}</span>
                                  </span>
                                      )}
                                    </div>

                                    {/* Pipeline Selector */}
                                    <div className="flex items-center gap-2">
                                      <Label htmlFor={`pipeline-${index}`} className="text-xs font-medium whitespace-nowrap">
                                        Pipeline:
                                      </Label>
                                      <Select
                                          value={selectedPipelines[index] || ""}
                                          onValueChange={(value) => handlePipelineChange(index, value)}
                                      >
                                        <SelectTrigger
                                            id={`pipeline-${index}`}
                                            className={`h-9 flex-1 ${!selectedPipelines[index] ? 'border-amber-300 bg-amber-50' : ''}`}
                                        >
                                          <SelectValue placeholder="Select pipeline..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {isLoadingPipelines ? (
                                              <div className="flex items-center justify-center p-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              </div>
                                          ) : (
                                              <>
                                                {pipelines.map((pipeline) => (
                                                    <SelectItem key={pipeline.id} value={pipeline.id}>
                                                      {pipeline.name}
                                                    </SelectItem>
                                                ))}

                                                <Separator className="my-1" />

                                                <button
                                                    type="button"
                                                    className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-accent"
                                                    onClick={() => {
                                                      setCurrentPipelineIndex(index);
                                                      setShowCreatePipeline(true);
                                                    }}
                                                >
                                                  + Create Pipeline
                                                </button>
                                              </>
                                          )}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  {/* Delete Button */}
                                  <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveLead(index);
                                      }}
                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardHeader>

                              {/* Expandable Details */}
                              <CollapsibleContent>
                                <Separator />
                                <CardContent className="p-4 pt-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Name */}
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium">
                                        Business Name <span className="text-destructive">*</span>
                                      </Label>
                                      <Input
                                          value={lead.name || ""}
                                          onChange={(e) => handleFieldChange(index, "name", e.target.value)}
                                          placeholder="Enter business name"
                                          className="h-9"
                                      />
                                    </div>

                                    {/* Phone */}
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        Phone Number <span className="text-destructive">*</span>
                                      </Label>
                                      <Input
                                          value={lead.phone || ""}
                                          onChange={(e) => handleFieldChange(index, "phone", normalizePhone(e.target.value))}
                                          placeholder="Enter phone number"
                                          className={`h-9 ${!lead.phone ? "border-destructive bg-red-50":""}`}
                                      />
                                    </div>

                                    {/* Email */}
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        Email Address
                                      </Label>
                                      <Input
                                          type="email"
                                          value={lead.email || ""}
                                          onChange={(e) => handleFieldChange(index, "email", e.target.value)}
                                          placeholder="email@example.com"
                                          className="h-9"
                                      />
                                    </div>

                                    {/* Website */}
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium flex items-center gap-1">
                                        <Globe className="h-3 w-3" />
                                        Website
                                      </Label>
                                      <div className="flex gap-2">
                                        <Input
                                            value={lead.url || ""}
                                            onChange={(e) => handleFieldChange(index, "url", e.target.value)}
                                            placeholder="https://..."
                                            className="h-9 flex-1"
                                        />
                                        {lead.url && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-9 px-3"
                                                asChild
                                            >
                                              <a
                                                  href={lead.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                              >
                                                <ExternalLink className="h-4 w-4" />
                                              </a>
                                            </Button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Address - Full Width */}
                                    <div className="space-y-1.5 md:col-span-2">
                                      <Label className="text-xs font-medium flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        Full Address
                                      </Label>
                                      <Input
                                          value={lead.address || ""}
                                          onChange={(e) => handleFieldChange(index, "address", e.target.value)}
                                          placeholder="Enter complete address"
                                          className="h-9"
                                      />
                                    </div>

                                    {/* Read-only fields */}
                                    {lead.source && (
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-medium text-muted-foreground">
                                            Source
                                          </Label>
                                          <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm">
                                            {lead.source}
                                          </div>
                                        </div>
                                    )}

                                    {lead.geo && (
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-medium text-muted-foreground">
                                            Coordinates
                                          </Label>
                                          <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm font-mono">
                                            {lead.geo}
                                          </div>
                                        </div>
                                    )}
                                  </div>
                                </CardContent>
                              </CollapsibleContent>
                            </Card>
                          </Collapsible>
                      ))}
                    </div>
                  </ScrollArea>
                </>
            ) : (
                // --- Step 2: Mapping UI ---
                <div className="h-full flex flex-col">
                  <div className="py-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Review the mapping between your CSV columns and the CRM fields. We've auto-matched fields where possible.
                    </p>
                    <div className="grid grid-cols-[1fr,40px,1fr] gap-4 font-medium text-sm text-muted-foreground px-4 mb-2">
                      <div>CSV Column</div>
                      <div className="text-center"></div>
                      <div>CRM Field</div>
                    </div>
                  </div>

                  <ScrollArea className="h-[calc(90vh-320px)] border rounded-md bg-muted/10">
                    <div className="p-4 space-y-3">
                      {csvFields.map((csvField) => (
                          <div key={csvField} className="grid grid-cols-[1fr,40px,1fr] gap-4 items-center bg-card p-3 rounded-lg border shadow-sm">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Badge variant="outline" className="text-sm font-normal px-2 py-1 truncate max-w-full" title={csvField}>
                                {csvField}
                              </Badge>
                            </div>

                            <div className="flex justify-center text-muted-foreground">
                              <ArrowRight className="h-4 w-4" />
                            </div>

                            <div>
                              <Select
                                  value={fieldMapping[csvField] || "ignore"}
                                  onValueChange={(val) => {
                                    setFieldMapping(prev => ({
                                      ...prev,
                                      [csvField]: val === "ignore" ? "" : val
                                    }));
                                  }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select field..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ignore" className="text-muted-foreground italic">
                                    -- Do not import --
                                  </SelectItem>
                                  {dbFields.map((field) => (
                                      <SelectItem key={field} value={field}>
                                        {field}
                                      </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
            )}
          </div>

          {/* Footer - Fixed */}
          <DialogFooter className="px-6 py-4 border-t bg-muted/30">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-muted-foreground">
                {step === 1 ? (
                    canProceed ? (
                        <span className="flex items-center gap-2 text-green-600 font-medium">
                    <Check className="h-4 w-4" />
                    Ready to proceed with {leads.length} lead(s)
                  </span>
                    ) : (
                        <span>Select pipelines for all leads to proceed</span>
                    )
                ) : (
                    <span>
                  Mapping {Object.keys(fieldMapping).length} of {csvFields.length} columns
                </span>
                )}
              </div>
              <div className="flex gap-3">
                {step === 1 ? (
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isImporting || isLoadingHeaders}
                    >
                      Cancel
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        onClick={() => setStep(1)}
                        disabled={isImporting}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                )}

                {step === 1 ? (
                    <Button
                        onClick={handleNextStep}
                        disabled={!canProceed}
                        className="min-w-[140px]"
                    >
                      {isLoadingHeaders ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                      ) : (
                          <>
                            Next Step
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                      )}
                    </Button>
                ) : (
                    <Button
                        onClick={handleFinalImport}
                        disabled={isImporting}
                        className="min-w-[160px]"
                    >
                      {isImporting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Importing...
                          </>
                      ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Import {leads.length} Lead(s)
                          </>
                      )}
                    </Button>
                )}
              </div>
            </div>

          </DialogFooter>
        </DialogContent>
        {showCreatePipeline && (
            <CreatePipelineModal
                open={showCreatePipeline}
                onCreate={(pipeline) => {
                  // Add pipeline to dropdown list
                  setPipelines((prev) => [...prev, pipeline]);

                  // Auto-select pipeline for the lead that opened the modal
                  if (currentPipelineIndex !== null) {
                    setSelectedPipelines((prev) => ({
                      ...prev,
                      [currentPipelineIndex]: pipeline.id,
                    }));
                  }

                  // Cleanup
                  setShowCreatePipeline(false);
                  setCurrentPipelineIndex(null);
                }}
                onClose={() => {
                  setShowCreatePipeline(false);
                  setCurrentPipelineIndex(null);
                }}
            />
        )}
      </Dialog>
  );
}