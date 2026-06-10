import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  fetchProviderApplication, approveApplication, rejectApplication, reopenApplication,
  verifyApplicationDocs, requestDocumentReupload, AppVerificationResult,
} from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ArrowLeft, CheckCircle, XCircle, Clock,
  User, Phone, Mail, MapPin, Wrench, Truck,
  Building2, CreditCard, Users, FileText,
  IdCard, Camera, FileCheck, ExternalLink, Shield, RotateCcw, Trash2,
  Sparkles, AlertTriangle, HelpCircle, MessageSquare,
} from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved')
    return (
      <Badge className="gap-1.5 bg-green-500/15 text-green-400 border border-green-500/25">
        <CheckCircle size={13} /> Approved
      </Badge>
    );
  if (status === 'rejected')
    return (
      <Badge variant="destructive" className="gap-1.5">
        <XCircle size={13} /> Rejected
      </Badge>
    );
  if (status === 'revoked')
    return (
      <Badge className="gap-1.5 bg-gray-500/15 text-gray-400 border border-gray-500/25">
        <Trash2 size={13} /> Revoked
      </Badge>
    );
  return (
    <Badge className="gap-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/25">
      <Clock size={13} /> Pending Review
    </Badge>
  );
}

function InfoRow({ label, value, icon: Icon }: {
  label: string; value?: string | null; icon?: React.ElementType;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      {Icon && <Icon size={15} className="text-muted-foreground mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

function DocPreview({ label, url, icon: Icon }: {
  label: string; url?: string | null; icon: React.ElementType;
}) {
  if (!url) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon size={18} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">Not provided</p>
        </div>
      </div>
    );
  }

  const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {isImage ? (
        <div className="relative">
          <img src={url} alt={label} className="w-full h-44 object-cover bg-muted" />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 px-3 py-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-white">{label}</span>
            <a href={url} target="_blank" rel="noreferrer" className="text-white/80 hover:text-white transition-colors">
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-muted/20">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Icon size={18} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">Document uploaded</p>
          </div>
          <a href={url} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <ExternalLink size={12} /> Open
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}

// ── AI verdict helpers ────────────────────────────────────────────────────────

function isApproveBlocked(r: AppVerificationResult | null): boolean {
  if (!r) return false;
  const { recommendation, duplicate_id_detected, id_expired } = r.overall;
  return recommendation === 'reject' || duplicate_id_detected || id_expired;
}

function getAutoRejectContext(r: AppVerificationResult): { reason: string; chips: string[] } | null {
  if (r.overall.recommendation !== 'reject') return null;
  const chips: string[] = [];
  const flags = r.overall.flags;

  if (r.overall.duplicate_id_detected) {
    chips.push('Already registered on the platform');
    return {
      reason: `This national ID is already registered under another account on MOTOFIX (Application #${r.overall.duplicate_app_id ?? '?'}). Duplicate registrations are not permitted.`,
      chips,
    };
  }
  if (r.overall.id_expired) {
    chips.push('Documents were unclear or unreadable');
    return {
      reason: `The national ID document has expired (expiry: ${r.overall.expiry_date ?? 'unknown'}). A valid, non-expired ID is required to register.`,
      chips,
    };
  }
  if (flags.includes('NO_DOCUMENTS')) {
    chips.push('Incomplete application — missing required documents');
    return {
      reason: 'No documents were found on the server for this application. Please re-apply with all required documents uploaded.',
      chips,
    };
  }
  if (r.cross_checks.name_matches_application === false || r.cross_checks.all_names_consistent === false) {
    chips.push('National ID did not match provided name');
    const disc = r.cross_checks.discrepancies.join('; ');
    return {
      reason: `The name on the submitted documents does not match the registered application name${disc ? ` (${disc})` : ''}. Please re-apply with matching documentation.`,
      chips,
    };
  }
  if (flags.includes('TAMPERING_DETECTED')) {
    chips.push('Suspicious or fraudulent information');
    return {
      reason: r.overall.rejection_reasons.join(' ') || 'Document tampering was detected during AI verification.',
      chips,
    };
  }
  return {
    reason: r.overall.rejection_reasons.join(' ') || r.overall.summary || 'Rejected based on AI document verification.',
    chips: ['Suspicious or fraudulent information'],
  };
}

export default function ApplicationDetail() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const [rejectOpen,    setRejectOpen]    = useState(false);
  const [rejectReason,  setRejectReason]  = useState('');
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [aiResult,      setAiResult]      = useState<AppVerificationResult | null>(null);
  const [isVerifying,   setIsVerifying]   = useState(false);
  const [isRequestingReupload, setIsRequestingReupload] = useState(false);

  const toggleChip = (chip: string) => {
    const updated = selectedChips.includes(chip)
      ? selectedChips.filter(c => c !== chip)
      : [...selectedChips, chip];
    setSelectedChips(updated);
    setRejectReason(updated.join('. ') + (updated.length > 0 ? '.' : ''));
  };

  const { data: app, isLoading } = useQuery({
    queryKey: ['provider-application', id],
    queryFn:  () => fetchProviderApplication(id!),
    enabled:  !!id,
  });

  const approveMut = useMutation({
    mutationFn: () => approveApplication(id!),
    onSuccess: () => {
      toast.success('Application approved — credentials sent via SMS.');
      qc.invalidateQueries({ queryKey: ['provider-applications'] });
      qc.invalidateQueries({ queryKey: ['provider-application', id] });
    },
    onError: () => toast.error('Failed to approve application.'),
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectApplication(id!, rejectReason),
    onSuccess: () => {
      toast.success('Application rejected.');
      setRejectOpen(false);
      setRejectReason('');
      setSelectedChips([]);
      qc.invalidateQueries({ queryKey: ['provider-applications'] });
      qc.invalidateQueries({ queryKey: ['provider-application', id] });
    },
    onError: () => toast.error('Failed to reject application.'),
  });

  const reopenMut = useMutation({
    mutationFn: () => reopenApplication(id!),
    onSuccess: () => {
      toast.success('Application re-opened for review.');
      qc.invalidateQueries({ queryKey: ['provider-applications'] });
      qc.invalidateQueries({ queryKey: ['provider-application', id] });
    },
    onError: () => toast.error('Failed to re-open application.'),
  });

  const openRejectWith = (chips: string[], reason: string) => {
    setSelectedChips(chips);
    setRejectReason(reason);
    setRejectOpen(true);
  };

  const runAiVerification = async () => {
    setIsVerifying(true);
    setAiResult(null);
    try {
      const result = await verifyApplicationDocs(id!);
      setAiResult(result);
      if (isPending) {
        const ctx = getAutoRejectContext(result);
        if (ctx) openRejectWith(ctx.chips, ctx.reason);
      }
    } catch {
      toast.error('AI verification failed — please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRequestReupload = async (docs: string[]) => {
    setIsRequestingReupload(true);
    try {
      await requestDocumentReupload(id!, docs);
      toast.success('Re-upload request sent — applicant notified by SMS.');
      qc.invalidateQueries({ queryKey: ['provider-application', id] });
    } catch {
      toast.error('Failed to send re-upload request.');
    } finally {
      setIsRequestingReupload(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!app) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Application not found.</p>
      </DashboardLayout>
    );
  }

  const isPending  = app.verification_status === 'pending';
  const isRejected = app.verification_status === 'rejected';

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">

        {/* ── Header ── */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/applications')} className="shrink-0 mt-0.5">
            <ArrowLeft size={18} />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{app.full_name}</h1>
              <StatusBadge status={app.verification_status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Submitted {format(new Date(app.submitted_at), 'MMMM d, yyyy · h:mm a')}
              {app.reviewed_at && (
                <> · Reviewed {format(new Date(app.reviewed_at), 'MMM d, yyyy')}</>
              )}
            </p>
          </div>
          {isPending && (
            <div className="hidden sm:flex gap-2 shrink-0">
              <Button
                variant="outline"
                className="gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                onClick={() => setRejectOpen(true)}>
                <XCircle size={16} /> Reject
              </Button>
              {!isApproveBlocked(aiResult) && (
                <Button
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => approveMut.mutate()}
                  disabled={approveMut.isPending}>
                  {approveMut.isPending
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <CheckCircle size={16} />}
                  Approve
                </Button>
              )}
            </div>
          )}
          {isRejected && (
            <div className="hidden sm:flex shrink-0">
              <Button
                variant="outline"
                className="gap-2 text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-500"
                onClick={() => reopenMut.mutate()}
                disabled={reopenMut.isPending}>
                {reopenMut.isPending
                  ? <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                  : <RotateCcw size={16} />}
                Re-open for Review
              </Button>
            </div>
          )}
        </div>

        {/* Rejection / revocation reason banner */}
        {app.rejection_reason && app.verification_status !== 'revoked' && (
          <div className="flex gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/25">
            <XCircle size={16} className="text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive mb-1">Rejection reason</p>
              <p className="text-sm text-muted-foreground">{app.rejection_reason}</p>
            </div>
          </div>
        )}
        {app.verification_status === 'revoked' && (
          <div className="flex gap-3 p-4 rounded-lg bg-gray-500/10 border border-gray-500/25">
            <Trash2 size={16} className="text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-400 mb-1">Account revoked</p>
              <p className="text-sm text-muted-foreground">{app.rejection_reason ?? 'Provider account was permanently deleted by an administrator.'}</p>
            </div>
          </div>
        )}

        {/* ── Two-column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Left: info cards */}
          <div className="space-y-4">

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <User size={13} /> Personal Information
              </h3>
              <InfoRow label="Full Name" value={app.full_name} icon={User} />
              <InfoRow label="Phone"     value={app.phone}     icon={Phone} />
              <InfoRow label="Email"     value={app.email}     icon={Mail} />
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Wrench size={13} /> Service Details
              </h3>
              <InfoRow
                label="Provider Type"
                value={app.provider_type === 'mechanic' ? 'Mechanic' : 'Towing Provider'}
                icon={app.provider_type === 'mechanic' ? Wrench : Truck}
              />
              <InfoRow label="Specializations"  value={app.specializations?.replace(/,/g, ', ')} icon={Shield} />
              <InfoRow label="Service Area"     value={app.service_area}    icon={MapPin} />
              <InfoRow label="Years Experience" value={app.years_experience ? `${app.years_experience} years` : null} icon={Shield} />
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Building2 size={13} /> Business Details
              </h3>
              <InfoRow label="Business Name"      value={app.business_name}       icon={Building2} />
              <InfoRow label="Registration No."   value={app.business_reg_number} icon={FileText} />
              <InfoRow label="Affiliated Garages" value={app.garage_affiliation}  icon={Building2} />
              <InfoRow label="Address"            value={app.business_address}    icon={MapPin} />
              <InfoRow label="Mobile Money"       value={app.mobile_money_number} icon={CreditCard} />
            </div>

            {(app.referral_name || app.referral_phone) && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Users size={13} /> Referral Contact
                </h3>
                <InfoRow label="Name"  value={app.referral_name}  icon={User} />
                <InfoRow label="Phone" value={app.referral_phone} icon={Phone} />
              </div>
            )}
          </div>

          {/* Right: documents + AI verification */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <IdCard size={13} /> Submitted Documents
              </h3>
              <div className="space-y-3">
                <DocPreview label="Face Scan / Selfie" url={app.face_scan_url}     icon={Camera}    />
                <DocPreview label="National ID"        url={app.national_id_url}   icon={IdCard}    />
                <DocPreview label="Certification"      url={app.certification_url} icon={FileCheck} />
                <DocPreview label="Profile Photo"      url={app.profile_photo_url} icon={Camera}    />
              </div>
            </div>

            {/* AI Document Verification */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Sparkles size={13} /> AI Document Check
                </h3>
                <Button
                  size="sm" variant="outline" className="gap-1.5 text-xs h-7"
                  disabled={isVerifying}
                  onClick={runAiVerification}
                >
                  {isVerifying
                    ? <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Analysing…</>
                    : <><Sparkles size={12} /> {aiResult ? 'Re-run' : 'Verify All Documents'}</>}
                </Button>
              </div>

              {!aiResult && !isVerifying && (
                <p className="text-xs text-muted-foreground">
                  Click <span className="font-medium text-foreground">Verify All Documents</span> to have Claude check the National ID, Certification, and Profile Photo for authenticity, cross-match names and dates, detect expired documents, and flag duplicate ID registrations.
                </p>
              )}

              {isVerifying && (
                <div className="flex items-center gap-2 py-6 justify-center">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Claude is analysing all documents…</p>
                </div>
              )}

              {aiResult && !isVerifying && (() => {
                const { overall, cross_checks, national_id, certification, profile_photo } = aiResult;
                const rec = overall.recommendation;

                return (
                  <div className="space-y-3">

                    {/* ── Overall verdict ── */}
                    {rec === 'approve' && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <CheckCircle size={15} className="text-green-400 shrink-0" />
                        <div><p className="text-sm font-semibold text-green-400">All Clear — Approve</p>
                          <p className="text-xs text-muted-foreground">{overall.summary}</p></div>
                      </div>
                    )}
                    {rec === 'reject' && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/25">
                        <XCircle size={15} className="text-destructive shrink-0" />
                        <div><p className="text-sm font-semibold text-destructive">Rejected by AI</p>
                          <p className="text-xs text-muted-foreground">{overall.summary}</p></div>
                      </div>
                    )}
                    {rec === 'reupload_needed' && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                        <div><p className="text-sm font-semibold text-amber-400">Documents Need Re-uploading</p>
                          <p className="text-xs text-muted-foreground">{overall.summary}</p></div>
                      </div>
                    )}

                    {/* ── Per-document status grid ── */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'National ID', doc: national_id },
                        { label: 'Certification', doc: certification },
                        { label: 'Profile Photo', doc: profile_photo },
                      ].map(({ label, doc }) => {
                        const q = doc?.quality ?? 'unreadable';
                        const genuine = (doc as any)?.appears_genuine ?? null;
                        const color = !doc || q === 'unreadable' ? 'text-destructive'
                          : q === 'poor' ? 'text-amber-400'
                          : genuine === false ? 'text-destructive'
                          : 'text-green-400';
                        const icon = !doc || q === 'unreadable' ? <XCircle size={12} />
                          : q === 'poor' ? <AlertTriangle size={12} />
                          : <CheckCircle size={12} />;
                        return (
                          <div key={label} className="p-2 rounded-lg bg-muted/30 border border-border">
                            <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>
                            <div className={`flex items-center gap-1 text-xs font-semibold ${color}`}>
                              {icon}
                              <span>{!doc ? 'Missing' : q === 'unreadable' ? 'Unreadable' : q === 'poor' ? 'Poor' : genuine === false ? 'Suspicious' : 'OK'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Cross-checks ── */}
                    <div className="space-y-1 pt-1">
                      {[
                        { label: 'Name matches application', val: cross_checks.name_matches_application },
                        { label: 'Names consistent across docs', val: cross_checks.all_names_consistent },
                        { label: 'Date of birth consistent', val: cross_checks.dob_consistent },
                      ].filter(r => r.val !== null).map(({ label, val }) => (
                        <div key={label} className="flex items-center gap-2 text-xs py-1 border-b border-border/50 last:border-0">
                          {val
                            ? <CheckCircle size={12} className="text-green-400 shrink-0" />
                            : <XCircle size={12} className="text-destructive shrink-0" />}
                          <span className="text-muted-foreground flex-1">{label}</span>
                          <span className={`font-medium ${val ? 'text-green-400' : 'text-destructive'}`}>{val ? 'Pass' : 'Fail'}</span>
                        </div>
                      ))}
                      {cross_checks.discrepancies.map((d, i) => (
                        <p key={i} className="text-xs text-destructive pl-5">· {d}</p>
                      ))}
                    </div>

                    {/* ── Extracted key fields from National ID ── */}
                    {national_id?.extracted && (
                      <div className="space-y-1">
                        {national_id.extracted.name && (
                          <div className="flex justify-between text-xs py-1 border-b border-border/50">
                            <span className="text-muted-foreground">ID name</span>
                            <span className="font-medium">{national_id.extracted.name}</span>
                          </div>
                        )}
                        {national_id.extracted.id_number && (
                          <div className="flex justify-between text-xs py-1 border-b border-border/50">
                            <span className="text-muted-foreground">ID number</span>
                            <span className="font-mono font-medium">{national_id.extracted.id_number}</span>
                          </div>
                        )}
                        {national_id.extracted.date_of_birth && (
                          <div className="flex justify-between text-xs py-1 border-b border-border/50">
                            <span className="text-muted-foreground">Date of birth</span>
                            <span className="font-medium">{national_id.extracted.date_of_birth}</span>
                          </div>
                        )}
                        {national_id.extracted.expiry_date && (
                          <div className="flex justify-between text-xs py-1 border-b border-border/50">
                            <span className="text-muted-foreground">ID expiry</span>
                            <span className={`font-medium ${overall.id_expired ? 'text-destructive' : ''}`}>
                              {national_id.extracted.expiry_date}
                              {overall.id_expired && ' · EXPIRED'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Special flags ── */}
                    {(overall.duplicate_id_detected || overall.id_expired || overall.flags.includes('TAMPERING_DETECTED')) && (
                      <div className="flex gap-2 p-2.5 rounded-lg bg-destructive/8 border border-destructive/20">
                        <AlertTriangle size={13} className="text-destructive shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          {overall.duplicate_id_detected && (
                            <p className="text-xs font-semibold text-destructive">
                              Duplicate ID — already registered under Application #{overall.duplicate_app_id}
                            </p>
                          )}
                          {overall.id_expired && (
                            <p className="text-xs font-semibold text-destructive">
                              National ID expired on {overall.expiry_date}
                            </p>
                          )}
                          {overall.flags.includes('TAMPERING_DETECTED') && (
                            <p className="text-xs font-semibold text-destructive">Document tampering detected</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Rejection reasons ── */}
                    {overall.rejection_reasons.length > 0 && (
                      <div className="flex gap-2 p-2.5 rounded-lg bg-muted/30 border border-border">
                        <AlertTriangle size={13} className="text-muted-foreground shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          {overall.rejection_reasons.map((r, i) => (
                            <p key={i} className="text-xs text-muted-foreground">· {r}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Action panel (only while pending) ── */}
                    {isPending && (
                      <div className="pt-3 border-t border-border">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <MessageSquare size={11} />
                            Applicant notified by SMS on rejection
                          </span>
                          <div className="flex gap-2 flex-wrap">
                            {rec === 'reupload_needed' && overall.reupload_documents.length > 0 && (
                              <Button
                                size="sm" variant="outline"
                                className="gap-1.5 text-xs h-7 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                                disabled={isRequestingReupload}
                                onClick={() => handleRequestReupload(overall.reupload_documents)}
                              >
                                {isRequestingReupload
                                  ? <div className="w-3 h-3 border border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                                  : <AlertTriangle size={12} />}
                                Request Re-upload
                              </Button>
                            )}
                            <Button
                              size="sm" variant="outline"
                              className="gap-1.5 text-xs h-7 text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                              onClick={() => {
                                const ctx = getAutoRejectContext(aiResult);
                                if (ctx) openRejectWith(ctx.chips, ctx.reason);
                                else setRejectOpen(true);
                              }}
                            >
                              <XCircle size={12} /> Reject
                            </Button>
                            {!isApproveBlocked(aiResult) && (
                              <Button
                                size="sm"
                                className="gap-1.5 text-xs h-7 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => approveMut.mutate()}
                                disabled={approveMut.isPending}
                              >
                                {approveMut.isPending
                                  ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                                  : <CheckCircle size={12} />}
                                Approve
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Mobile action buttons */}
        {isPending && (
          <div className="flex gap-3 sm:hidden">
            <Button
              variant="outline" className="flex-1 gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
              onClick={() => setRejectOpen(true)}>
              <XCircle size={16} /> Reject
            </Button>
            {!isApproveBlocked(aiResult) && (
              <Button
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
                <CheckCircle size={16} /> Approve
              </Button>
            )}
          </div>
        )}
        {isRejected && (
          <div className="flex sm:hidden">
            <Button
              variant="outline" className="flex-1 gap-2 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => reopenMut.mutate()} disabled={reopenMut.isPending}>
              <RotateCcw size={16} /> Re-open for Review
            </Button>
          </div>
        )}
      </div>

      {/* ── Reject dialog ── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              Select one or more reasons, or write a custom message. All selected reasons will be combined into one message sent to the applicant.
            </p>

            {/* Multi-select chips */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Quick reasons {selectedChips.length > 0 && <span className="normal-case font-normal text-destructive ml-1">· {selectedChips.length} selected</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  'Documents were unclear or unreadable',
                  'National ID did not match provided name',
                  'Certification could not be verified',
                  'Incomplete application — missing required documents',
                  'Profile photo does not meet requirements',
                  'Service area not currently supported',
                  'Already registered on the platform',
                  'Suspicious or fraudulent information',
                ].map(chip => {
                  const active = selectedChips.includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggleChip(chip)}
                      className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all"
                      style={{
                        background: active ? 'rgba(239,68,68,0.12)' : 'var(--adm-surface-2)',
                        borderColor: active ? '#ef4444' : 'var(--adm-border)',
                        color: active ? '#ef4444' : 'var(--adm-text-sub)',
                        boxShadow: active ? '0 0 0 2px rgba(239,68,68,0.18)' : 'none',
                      }}
                    >
                      {active && '✓ '}{chip}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Combined message preview / custom edit */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {selectedChips.length > 0 ? 'Combined message — edit if needed' : 'Or write a custom reason'}
              </p>
              <Textarea
                placeholder="Select reasons above or type a custom message…"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageSquare size={11} className="shrink-0" />
              An SMS rejection notice will be sent to <span className="font-medium text-foreground">{app?.phone}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setRejectOpen(false); setSelectedChips([]); setRejectReason(''); }}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={!rejectReason.trim() || rejectMut.isPending}
                onClick={() => rejectMut.mutate()}>
                {rejectMut.isPending ? 'Rejecting…' : 'Confirm Rejection'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
