import React from 'react';
import { Download } from 'lucide-react';

export const CsvTemplates: React.FC = () => {
  const downloadTemplateV2 = () => {
    const headers = [
      'work_order_no', 'customer_name', 'customer_phone', 'customer_phone2', 
      'address', 'product_type', 'product_model', 'technician_name', 
      'service_center', 'repair_date', 'Schedule Date', 'brand', 
      'total_fee', 'assigned_agent_email', 'solution', 'remark'
    ];
    const exampleRow = [
      'WO2026001', 'John Doe', '09123456789', '', 
      'No. 123, Main St, Yangon', 'Air Conditioner', 'MS-12CRN1', 'Aung Aung', 
      'Yangon SC', '15/05/2026', '16/05/2026', 'Midea', 
      '25000', 'agent@midea-internal.com', 'Cleaned filter', 'Customer happy'
    ];
    
    const csvContent = [headers.join(','), exampleRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nps_upload_template_v2.csv';
    a.click();
  };

  return (
    <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-[#0092d0]/20 flex flex-col items-center gap-4">
      <div className="w-12 h-12 bg-[#f4fbff] rounded-full flex items-center justify-center text-[#0092d0]">
        <Download className="w-6 h-6" />
      </div>
      <div className="text-center">
        <h4 className="text-sm font-black text-[#003b6d] uppercase">Standard CSV Template</h4>
        <p className="text-[10px] font-bold text-gray-400 mt-1">Download the official template for data ingestion.</p>
      </div>
      <button 
        onClick={downloadTemplateV2}
        className="px-6 py-2 bg-[#0092d0] text-white text-[10px] font-black uppercase rounded-xl hover:bg-[#003b6d] transition-all shadow-lg shadow-blue-500/20"
      >
        Download v2.0 Template
      </button>
    </div>
  );
};
