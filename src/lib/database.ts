// Tipos de la base (equivalentes a `npx supabase gen types typescript`, escritos a mano).
type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

type ServiceRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  duration_min: number;
  price: number | null;
  show_price: boolean;
  featured: boolean;
  active: boolean;
  sort: number;
  image_url: string | null;
  image_path: string | null;
};

/** Lo que ve la web pública (vista services_web): precio null si está oculto. */
type ServiceWebRow = Omit<ServiceRow, 'show_price'>;

type BookingRow = {
  id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  notes: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  gcal_event_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      settings: Table<{
        id: number;
        tz: string;
        buffer_min: number;
        min_notice_hours: number;
        max_days_ahead: number;
        deposit_pct: number;
        mp_alias: string;
      }>;
      services: Table<ServiceRow, 'slug' | 'name'>;
      slots: Table<{ starts_at: string; created_at: string }, 'starts_at'>;
      bookings: {
        Row: BookingRow;
        Insert: Partial<BookingRow> & Pick<BookingRow, 'service_id' | 'starts_at' | 'ends_at' | 'client_name' | 'client_phone'>;
        Update: Partial<BookingRow>;
        Relationships: [
          { foreignKeyName: 'bookings_service_id_fkey'; columns: ['service_id']; isOneToOne: false; referencedRelation: 'services'; referencedColumns: ['id'] },
        ];
      };
      admins: Table<{ user_id: string }, 'user_id'>;
    };
    Views: {
      services_web: { Row: ServiceWebRow; Relationships: [] };
    };
    Functions: {
      get_slots: {
        Args: { p_service_id: string; p_from: string; p_to: string };
        Returns: { slot_start: string; slot_end: string }[];
      };
      request_booking: {
        Args: {
          p_service_id: string;
          p_start: string;
          p_name: string;
          p_phone: string;
          p_email?: string | null;
          p_notes?: string | null;
        };
        Returns: {
          booking_id: string;
          booking_start: string;
          booking_end: string;
          covered_slots: string[];
          next_free: string;
        }[];
      };
      set_day_slots: { Args: { p_day: string; p_times: string[] }; Returns: number };
      copy_week_slots: { Args: { p_src_monday: string; p_dst_monday: string }; Returns: number };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
