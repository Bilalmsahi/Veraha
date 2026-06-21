import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { downloadTemplateFn } from '@/api/policyLibrary';
import type { PolicyListItem } from '@/api/policies';
import {
  MoreHorizontal,
  Pencil,
  Archive,
  Trash2,
  ExternalLink,
  Download,
  FileSpreadsheet,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/apiError';

type PolicyActionsProps = {
  policy: PolicyListItem & { templateId?: { _id: string; filename?: string } | string };
  onView?: () => void;
  onEditContent?: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive?: () => void;
  onDelete: () => void;
  /** For Download template - when policy is from library */
  onDownloadAcceptanceHistory?: () => void;
};

export function PolicyActions({
  policy,
  onView,
  onEditContent,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  onDownloadAcceptanceHistory,
}: PolicyActionsProps) {
  const permissions = usePermissions();
  const publishStatus = policy.status;
  const canArchive = permissions.canArchivePolicies && publishStatus !== 'ARCHIVED';
  const canUnarchive = permissions.canArchivePolicies && publishStatus === 'ARCHIVED';
  const canDelete = permissions.canDeletePolicies && (publishStatus === 'DRAFT' || publishStatus === 'ARCHIVED');

  const templateId =
    typeof policy.templateId === 'object' && policy.templateId
      ? policy.templateId._id
      : typeof policy.templateId === 'string'
        ? policy.templateId
        : null;
  const templateFilename =
    typeof policy.templateId === 'object' && policy.templateId && 'filename' in policy.templateId
      ? policy.templateId.filename ?? 'template.docx'
      : 'template.docx';

  const handleCopyPermalink = () => {
    const url = window.location.origin + `/policies/${policy._id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  const handleDownloadTemplate = async () => {
    if (!templateId) return;
    try {
      await downloadTemplateFn(templateId, templateFilename);
      toast.success('Download started');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onView && (
          <DropdownMenuItem onClick={onView}>
            <ExternalLink className="mr-2 size-4" />
            View
          </DropdownMenuItem>
        )}
        {templateId && (
          <DropdownMenuItem onClick={handleDownloadTemplate}>
            <Download className="mr-2 size-4" />
            Download template
          </DropdownMenuItem>
        )}
        {onDownloadAcceptanceHistory && (
          <DropdownMenuItem onClick={onDownloadAcceptanceHistory}>
            <FileSpreadsheet className="mr-2 size-4" />
            Download acceptance history
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleCopyPermalink}>
          <Link2 className="mr-2 size-4" />
          Copy policy permalink
        </DropdownMenuItem>
        {permissions.canEditPolicyVersions && onEditContent && policy.status !== 'ARCHIVED' && (
          <DropdownMenuItem onClick={onEditContent}>
            <Pencil className="mr-2 size-4" />
            Edit content
          </DropdownMenuItem>
        )}
        {permissions.canEditPolicies && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 size-4" />
            Edit details
          </DropdownMenuItem>
        )}
        {canArchive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="mr-2 size-4" />
              Archive
            </DropdownMenuItem>
          </>
        )}
        {canUnarchive && onUnarchive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onUnarchive}>
              <Archive className="mr-2 size-4" />
              Unarchive
            </DropdownMenuItem>
          </>
        )}
        {canDelete && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="mr-2 size-4" />
            Delete policy
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
