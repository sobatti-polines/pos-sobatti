import { PriceTag } from '@/components/price-tag';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Demo Price Tag | POS Sobatti',
};

export default function DemoPriceTagPage() {
  return (
    <div className="min-h-screen bg-neutral-200 flex flex-col items-center justify-center p-8 gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Desain Price Tag Template</h1>
        <p className="text-gray-600">UI component presisi tinggi berdasarkan referensi gambar.</p>
      </div>
      
      <PriceTag 
        productName="AMPLAS BULAT 120 SAB"
        sku="AMP BLT 120"
        price={3200000}
      />
    </div>
  );
}
