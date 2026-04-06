import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Download } from 'lucide-react';

const ProductFilesView = ({ productId }) => {
  const [fileEntries, setFileEntries] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;
    const fetchData = async () => {
      const [entriesRes, matsRes] = await Promise.all([
        supabase.from('product_files').select('*, product_file_versions(*)')
          .eq('product_id', productId)
          .order('sort_order')
          .order('version_number', { referencedTable: 'product_file_versions', ascending: true }),
        supabase.from('product_materials').select('*'),
      ]);
      if (entriesRes.data) setFileEntries(entriesRes.data);
      if (matsRes.data) setMaterials(matsRes.data);
      setLoading(false);
    };
    fetchData();
  }, [productId]);

  const getMaterial = (id) => materials.find(m => m.id === id);

  if (loading || fileEntries.length === 0) return null;

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
        <FileText size={16} className="text-indigo-500" />
        ไฟล์ที่เกี่ยวข้อง
        <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full normal-case tracking-normal">{fileEntries.length} รายการ</span>
      </h3>

      <div className="space-y-3">
        {fileEntries.map(entry => {
          const links = entry.product_file_versions || [];
          const material = getMaterial(entry.material_id);

          return (
            <div key={entry.id} className="flex items-start gap-3 p-3 border border-gray-100 rounded-xl bg-white hover:bg-gray-50 transition-colors">
              {/* Thumbnail */}
              <div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                {entry.thumbnail_url
                  ? <img src={entry.thumbnail_url} className="w-full h-full object-cover" />
                  : <div className="flex items-center justify-center h-full"><FileText size={20} className="text-gray-300" /></div>
                }
              </div>

              {/* Info + Links */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-gray-800 text-sm">{entry.name}</span>
                  {material && (
                    <span className="text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">{material.name}</span>
                  )}
                </div>
                {entry.notes && <p className="text-xs text-gray-400 mb-2">{entry.notes}</p>}

                {links.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {links.map(v => (
                      <a
                        key={v.id}
                        href={v.drive_download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                      >
                        <Download size={12} />
                        {v.drive_file_name}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-300 italic">ยังไม่มีลิงก์</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductFilesView;
