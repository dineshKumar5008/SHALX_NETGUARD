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
  FileText, Download, Plus, RefreshCw, FileCheck, Calendar, ShieldCheck, CheckCircle2, AlertCircle 
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

      // Construct API endpoint relative to apiClient baseURL (/api/v1)
      const endpoint = rep.download_url.startsWith('/api/v1')
        ? rep.download_url.replace('/api/v1', '')
        : rep.download_url.startsWith('/reports/download/')
        ? rep.download_url
        : `/reports/download/${rep.report_name}`;

      // Execute authenticated request with Bearer token
      const response = await apiClient.get(endpoint, {
        responseType: 'blob',
      });

      // Create Blob URL and trigger browser download
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span>EXECUTIVE PDF SECURITY REPORT GENERATION</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Automated PDF Documentation Built from Real Database & IDS Telemetry
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAnalyst && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              icon={<Plus size={13} />}
            >
              Generate New PDF Report
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={fetchReports} icon={<RefreshCw size={13} />}>
            Refresh
          </Button>
        </div>
      </div>

      {generationSuccess && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-800 text-xs font-mono text-emerald-300 rounded-lg flex items-center gap-2">
          <CheckCircle2 size={15} />
          <span>{generationSuccess}</span>
        </div>
      )}

      {downloadError && (
        <div className="p-3 bg-rose-950/70 border border-rose-800 text-xs font-mono text-rose-300 rounded-lg flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{downloadError}</span>
        </div>
      )}

      {/* Reports Table */}
      <Card title="Generated Security Posture & Incident Reports">
        {isLoading ? (
          <LoadingSpinner message="Querying Generated PDF Reports..." />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<FileCheck size={32} className="text-cyan-400" />}
            title="No PDF Reports Generated Yet"
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
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-slate-400 border-b border-[#1e293b]">
                <tr>
                  <th className="pb-3">Report ID</th>
                  <th className="pb-3">Report Document Name</th>
                  <th className="pb-3">Generated Timestamp</th>
                  <th className="pb-3">File Size</th>
                  <th className="pb-3 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reports.map((rep) => (
                  <tr key={rep.report_id} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 font-semibold text-cyan-400">{rep.report_id}</td>
                    <td className="py-3 font-medium text-slate-100 flex items-center gap-2">
                      <FileText size={14} className="text-slate-400" />
                      <span>{rep.report_name}</span>
                    </td>
                    <td className="py-3 text-slate-400">
                      {new Date(rep.generated_at).toLocaleString()} UTC
                    </td>
                    <td className="py-3 text-slate-300 font-semibold">
                      {Math.round(rep.file_size_bytes / 1024)} KB
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDownloadReport(rep)}
                        disabled={downloadingId === rep.report_id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 font-medium transition cursor-pointer disabled:opacity-50"
                      >
                        <Download size={12} className={downloadingId === rep.report_id ? 'animate-bounce' : ''} />
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
        title="Generate SHALX NETGUARD Security Report"
      >
        <form onSubmit={handleGenerateReport} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-slate-300 mb-1 uppercase font-semibold">Report Title</label>
            <input
              type="text"
              required
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 uppercase font-semibold">Evaluation Period</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg p-2.5 text-slate-100 outline-none"
            >
              <option value="daily">Daily Threat & Network Posture Report (Past 24h)</option>
              <option value="weekly">Weekly SOC Audit & Incidents Review</option>
              <option value="custom">All-Time Cumulative Summary</option>
            </select>
          </div>

          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 space-y-1">
            <div className="font-semibold text-slate-200 uppercase mb-1">Included Report Sections:</div>
            <div>&bull; 1. Executive Threat Posture Summary & Device Count</div>
            <div>&bull; 2. Top Priority Security Alerts & Severity Breakdown</div>
            <div>&bull; 3. Active Perimeter Firewall Blocked IP List</div>
            <div>&bull; 4. Strategic Defense & Hardening Recommendations</div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isGenerating} icon={<Download size={13} />}>
              Build & Compile PDF
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
