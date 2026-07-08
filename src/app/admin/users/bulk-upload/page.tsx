'use client';

import { useState } from 'react';
import Shell from '@/components/layout/Shell';

export default function BulkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/users/bulk-upload', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      setResults(data);
    } catch (e) {
      alert('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.location.href = '/api/users/bulk-upload';
  };

  return (
    <Shell>
      <div className="p-lg space-y-lg max-w-4xl mx-auto mt-xl">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-h1 font-h1">Bulk Upload Users</h2>
            <p className="text-body-md text-on-surface-variant">Upload an Excel (.xlsx) or CSV file containing multiple user records to onboard them at once.</p>
          </div>
          <button onClick={handleDownloadTemplate} className="px-md py-sm border border-outline-variant rounded-lg text-primary bg-primary-fixed hover:bg-primary-container font-label-md transition-colors flex items-center gap-xs">
            <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>
            Download Template
          </button>
        </div>
        
        <div className="border-2 border-dashed border-outline-variant rounded-xl p-xl flex flex-col items-center justify-center bg-surface-container-lowest mt-lg">
           <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor" className="text-[48px] text-primary mb-md"><path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H520q-33 0-56.5-23.5T440-240v-206l-64 62-56-56 160-160 160 160-56 56-64-62v206h220q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h100v80H260Zm220-280Z"/></svg>
           <input 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
              onChange={(e) => setFile(e.target.files?.[0] || null)} 
              className="mb-lg font-body-md file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-fixed file:text-primary hover:file:bg-primary-container hover:file:text-white transition-all cursor-pointer" 
           />
           <button 
             onClick={handleUpload} 
             disabled={!file || loading}
             className="px-lg py-sm bg-primary text-white rounded-lg disabled:opacity-50 font-label-md"
           >
             {loading ? 'Processing...' : 'Upload File'}
           </button>
        </div>

        {results && !results.error && (
           <div className="bg-surface-container-low border border-outline-variant p-lg rounded-xl mt-lg space-y-md">
              <h3 className="text-h3 font-h3">Upload Results</h3>
              <p className="text-body-sm text-on-surface-variant">Processed {results.totalRows} row(s).</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
                 <div className="bg-green-50 border border-green-200 p-md rounded-lg">
                    <span className="text-label-sm text-green-700">Created Successfully</span>
                    <p className="text-h2 font-h2 text-green-800">{results.createdCount || 0}</p>
                 </div>
                 <div className="bg-surface border border-outline-variant p-md rounded-lg">
                    <span className="text-label-sm text-on-surface-variant">Skipped (Exact Duplicates)</span>
                    <p className="text-h2 font-h2 text-on-surface">{results.skippedDuplicates || 0}</p>
                 </div>
                 <div className="bg-yellow-50 border border-yellow-200 p-md rounded-lg">
                    <span className="text-label-sm text-yellow-700">Skipped (Differing Data)</span>
                    <p className="text-h2 font-h2 text-yellow-800">{results.skippedDifferent?.length || 0}</p>
                 </div>
                 <div className="bg-red-50 border border-red-200 p-md rounded-lg">
                    <span className="text-label-sm text-red-700">Validation Errors</span>
                    <p className="text-h2 font-h2 text-red-800">{results.errors?.length || 0}</p>
                 </div>
              </div>

              {results.skippedDifferent?.length > 0 && (
                <div className="mt-md">
                  <h4 className="text-label-md text-yellow-800 mb-xs">Rows Skipped (Differing Data)</h4>
                  <ul className="text-body-sm text-on-surface-variant list-disc pl-md space-y-xs">
                    {results.skippedDifferent.map((item: any, i: number) => (
                      <li key={i}>Row {item.row} ({item.email}): Mismatches in {item.differences.join(', ')}</li>
                    ))}
                  </ul>
                </div>
              )}

              {results.warnings?.length > 0 && (
                <div className="mt-md">
                  <h4 className="text-label-md text-orange-800 mb-xs">Warnings (Created, but manager unassigned)</h4>
                  <ul className="text-body-sm text-on-surface-variant list-disc pl-md space-y-xs">
                    {results.warnings.map((item: any, i: number) => (
                      <li key={i}>Row {item.row} ({item.email}): {item.reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {results.errors?.length > 0 && (
                <div className="mt-md">
                  <h4 className="text-label-md text-red-800 mb-xs">Validation Errors (Not Created)</h4>
                  <ul className="text-body-sm text-on-surface-variant list-disc pl-md space-y-xs">
                    {results.errors.map((item: any, i: number) => (
                      <li key={i}>Row {item.row} ({item.email}): {item.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
           </div>
        )}
        {results?.error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-lg rounded-xl mt-lg">
            <h3 className="text-h3 font-h3 mb-xs">Error</h3>
            <p className="text-body-md">{results.error}</p>
          </div>
        )}
      </div>
    </Shell>
  );
}
