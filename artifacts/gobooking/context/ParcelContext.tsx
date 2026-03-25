import React, { createContext, useContext, useState } from "react";

export interface ParcelData {
  fromCity: string;
  toCity: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  parcelType: string;
  weight: string;
  description: string;
  deliveryType: string;
  paymentMethod: string;
  amount: number;
  trackingRef: string;
  photoUrls: string[];
}

interface ParcelContextType {
  parcel: Partial<ParcelData>;
  updateParcel: (data: Partial<ParcelData>) => void;
  resetParcel: () => void;
}

const ParcelContext = createContext<ParcelContextType | null>(null);

export function ParcelProvider({ children }: { children: React.ReactNode }) {
  const [parcel, setParcel] = useState<Partial<ParcelData>>({});

  const updateParcel = (data: Partial<ParcelData>) =>
    setParcel((prev) => ({ ...prev, ...data }));

  const resetParcel = () => setParcel({});

  return (
    <ParcelContext.Provider value={{ parcel, updateParcel, resetParcel }}>
      {children}
    </ParcelContext.Provider>
  );
}

export function useParcel() {
  const ctx = useContext(ParcelContext);
  if (!ctx) throw new Error("useParcel must be used within ParcelProvider");
  return ctx;
}
