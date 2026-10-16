export type Service = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  duration_min: number;
  price: number | null;
  featured: boolean;
  active: boolean;
  sort: number;
  image_url: string | null;
  image_path: string | null;
};

export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';

export type Booking = {
  id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  notes: string;
  status: BookingStatus;
  gcal_event_id: string | null;
  services: { name: string } | null;
};

export type Settings = {
  buffer_min: number;
  min_notice_hours: number;
  max_days_ahead: number;
};
