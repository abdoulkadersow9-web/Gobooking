import React, { createContext, useContext, useState } from "react";

export interface PassengerInfo {
  name: string;
  age: string;
  gender: "male" | "female" | "other";
  idType: string;
  idNumber: string;
  seatNumber: string;
}

export interface BookingState {
  tripId: string;
  selectedSeats: string[];
  selectedSeatNumbers: string[];
  passengers: PassengerInfo[];
  paymentMethod: "card" | "upi" | "wallet" | "netbanking";
  contactEmail: string;
  contactPhone: string;
  totalAmount: number;
}

interface BookingContextType {
  booking: BookingState | null;
  setBooking: (b: BookingState | null) => void;
  updateBooking: (partial: Partial<BookingState>) => void;
}

const BookingContext = createContext<BookingContextType | null>(null);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [booking, setBooking] = useState<BookingState | null>(null);

  const updateBooking = (partial: Partial<BookingState>) => {
    setBooking((prev) =>
      prev ? { ...prev, ...partial } : (partial as BookingState)
    );
  };

  return (
    <BookingContext.Provider value={{ booking, setBooking, updateBooking }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used within BookingProvider");
  return ctx;
}
