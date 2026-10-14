import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ReportMetadata } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { 
  FileText, Download, Plus, RefreshCw, FileCheck, CheckCircle2, AlertCircle 
} from 'lucide-react';

export const Reports: React.FC = () => {
  const { isAnalyst } = useAuth();
  const [reports, setReports] = useState<ReportMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Generate Report Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [reportTitle, setReportTitle] = useState<string>('SHALX NETGUARD SOC Executive Security Report');
  const [reportType, setReportType] = useState<string>('daily');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/reports/list');
      setReports(res.data);
    } catch (err) {
      console.error('Failed to load reports list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGenerationSuccess(null);
    try {
      const res = await apiClient.post('/reports/generate', {
        title: reportTitle,
        report_type: reportType,
        include_incidents: true,
        include_traffic: true,
        include_health: true,
      });
      setGenerationSuccess(`Generated ${res.data.report_name}`);
      setIsModalOpen(false);
      fetchReports();
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = async (rep: ReportMetadata) => {
    try {
      setDownloadingId(rep.report_id);
      setDownloadError(null);

      const endpoint = rep.download_url.startsWith('/api/v1')
        ? rep.download_url.replace('/api/v1', '')
        : rep.download_url.startsWith('/reports/download/')
        ? rep.download_url
        : `/reports/download/${rep.report_name}`;

      const response = await apiClient.get(endpoint, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', rep.report_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download PDF report:', err);
      setDownloadError(`Failed to download ${rep.report_name}. Please verify session authorization.`);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
            <span>Intelligence &amp; Logs</span>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Security Reports</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Executive Security Reports</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated SOC posture documentation compiled from live database records and threat telemetry
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAnalyst && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              icon={<Plus size={13} />}
            >
              Generate Report
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={fetchReports} icon={<RefreshCw size={13} />}>
            Refresh
          </Button>
        </div>
      </div>

      {generationSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800 rounded-lg flex items-center gap-2">
          <CheckCircle2 size={15} className="text-emerald-600" />
          <span>{generationSuccess}</span>
        </div>
      )}

      {downloadError && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs font-mono text-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle size={15} className="text-red-600" />
          <span>{downloadError}</span>
        </div>
      )}

      {/* Reports Table */}
      <Card title="Generated Security Posture & Incident Reports" subtitle="Compilation archive of executive PDF summaries">
        {isLoading ? (
          <LoadingSpinner message="Querying generated PDF reports archive..." />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<FileCheck size={28} className="text-slate-400" />}
            title="No PDF Reports Generated"
            description="Generate a daily or weekly executive report compiling threat events, firewall actions, and host metrics."
            action={
              isAnalyst && (
                <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
                  Generate First Report
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="soc-table">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Report Document Name</th>
                  <th>Generated Timestamp</th>
                  <th>File Size</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((rep) => (
                  <tr key={rep.report_id}>
                    <td className="font-semibold text-blue-600">{rep.report_id}</td>
                    <td className="font-medium text-slate-800 flex items-center gap-2">
                      <FileText size={14} className="text-slate-400 shrink-0" />
                      <span className="font-sans text-xs text-slate-800 font-semibold">{rep.report_name}</span>
                    </td>
                    <td className="text-slate-500">
                      {new Date(rep.generated_at).toLocaleString()} UTC
                    </td>
                    <td className="text-slate-700 font-medium">
                      {Math.round(rep.file_size_bytes / 1024)} KB
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleDownloadReport(rep)}
                        disabled={downloadingId === rep.report_id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-sans font-medium transition cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                      >
                        <Download size={12} className={downloadingId === rep.report_id ? 'animate-spin' : ''} />
                        <span>{downloadingId === rep.report_id ? 'Downloading...' : 'Download PDF'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Generate Report Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Generate SOC Security Report"
      >
        <form onSubmit={handleGenerateReport} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-slate-700 mb-1.5 uppercase font-semibold text-[11px]">Report Title</label>
            <input
              type="text"
              required
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded p-2.5 text-xs text-slate-900 font-mono outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1.5 uppercase font-semibold text-[11px]">Evaluation Scope &amp; Period</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded p-2.5 text-xs text-slate-900 font-mono outline-none"
            >
              <option value="daily">Daily Threat &amp; Network Posture Report (Past 24h)</option>
              <option value="weekly">Weekly SOC Audit &amp; Incidents Review</option>
              <option value="custom">All-Time Cumulative Summary</option>
            </select>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 space-y-1 text-xs">
            <div className="font-semibold text-slate-900 uppercase mb-1 text-[11px]">Included Report Sections:</div>
            <div className="text-slate-600">&bull; 1. Executive Threat Posture Summary &amp; Asset Counts</div>
            <div className="text-slate-600">&bull; 2. Priority Security Alerts &amp; Severity Distribution</div>
            <div className="text-slate-600">&bull; 3. Active Perimeter Firewall Blocked IP Register</div>
            <div className="text-slate-600">&bull; 4. Strategic Defense &amp; Hardening Recommendations</div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isGenerating} icon={<Download size={13} />}>
              Generate PDF
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
