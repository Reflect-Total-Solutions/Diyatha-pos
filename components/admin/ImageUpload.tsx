'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type ImageUploadProps = {
  value?: string;
  onChange: (url: string) => void;
};

export default function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `activity-icons/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('activity-images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('activity-images')
        .getPublicUrl(filePath);

      onChange(data.publicUrl);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Error uploading image');
      } else {
        setError('Error uploading image');
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {value && (
        <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Preview" className="h-full w-full object-cover" />
        </div>
      )}
      
      <div className="flex items-center gap-3">
        <label className="relative cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
          <span className="truncate">{isUploading ? 'Uploading...' : 'Choose Image'}</span>
          <input
            type="file"
            className="sr-only"
            accept="image/*"
            onClick={(e) => {
              (e.target as HTMLInputElement).value = '';
            }}
            onChange={handleUpload}
            disabled={isUploading}
          />
        </label>
        
        {value && (
          <button
            type="button"
            className="text-xs text-red-600 hover:underline"
            onClick={() => onChange('')}
          >
            Remove
          </button>
        )}
      </div>
      
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
