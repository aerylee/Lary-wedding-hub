// App view-models over the generated row types. Thin on purpose: the database is the
// source of truth, and `npm run db:types` keeps these honest.
import type { Tables, Enums } from './database.types';

export type Profile = Tables<'profiles'>;
export type Wedding = Tables<'weddings'>;
export type Membership = Tables<'memberships'>;
export type Invitation = Tables<'invitations'>;
export type ActivityEntry = Tables<'activity_log'>;
export type AppRole = Enums<'app_role'>;

export type Venue = Tables<'venues'>;
export type Task = Tables<'tasks'>;
export type BudgetCategory = Tables<'budget_categories'>;
export type BudgetLine = Tables<'budget_lines'>;
export type Payment = Tables<'payments'>;
export type Vendor = Tables<'vendors'>;
export type VendorFinance = Tables<'vendor_finance'>;
export type Guest = Tables<'guests'>;
export type GuestContact = Tables<'guest_contacts'>;
export type Rsvp = Tables<'rsvps'>;
export type WeddingEvent = Tables<'events'>;
export type Room = Tables<'rooms'>;
export type LegalDoc = Tables<'legal_docs'>;
export type Decision = Tables<'decisions'>;
export type SeatTable = Tables<'seat_tables'>;
export type ScheduleItem = Tables<'schedule_items'>;
export type CommsRow = Tables<'comms_rows'>;
export type Template = Tables<'templates'>;
export type Correspondence = Tables<'correspondence'>;
export type Attachment = Tables<'attachments'>;
export type Faq = Tables<'faqs'>;

export type VenueStatus = Enums<'venue_status'>;
export type TaskStatus = Enums<'task_status'>;
export type VendorStatus = Enums<'vendor_status'>;
export type LegalStatus = Enums<'legal_status'>;
export type DecisionStatus = Enums<'decision_status'>;
export type RsvpStatus = Enums<'rsvp_status'>;
export type ScheduleKind = Enums<'schedule_kind'>;
export type Currency = Enums<'currency_code'>;

/** Settings as the app sees them: the settings row plus the (finance-gated) ceiling. */
export type WeddingSettings = Omit<Tables<'wedding_settings'>, 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> & {
  /** null when the viewer lacks finance:read — the row simply doesn't load. */
  budget_ceiling_usd: number | null;
};

export type CollMap = {
  venues: Venue;
  tasks: Task;
  budget_categories: BudgetCategory;
  budget_lines: BudgetLine;
  payments: Payment;
  vendors: Vendor;
  vendor_finance: VendorFinance;
  guests: Guest;
  guest_contacts: GuestContact;
  rsvps: Rsvp;
  events: WeddingEvent;
  rooms: Room;
  legal_docs: LegalDoc;
  decisions: Decision;
  seat_tables: SeatTable;
  schedule_items: ScheduleItem;
  comms_rows: CommsRow;
  templates: Template;
  correspondence: Correspondence;
  attachments: Attachment;
  faqs: Faq;
};
export type CollName = keyof CollMap;

/** A row being written: id optional on insert; audit columns are set by triggers. */
export type Row = { id?: string; [k: string]: unknown };

export type Permission =
  | 'settings:read' | 'settings:write'
  | 'venues:read' | 'venues:write'
  | 'tasks:read' | 'tasks:write'
  | 'finance:read' | 'finance:write'
  | 'vendors:read' | 'vendors:write'
  | 'guests:read' | 'guests:write' | 'guests:contact'
  | 'travel:read' | 'travel:write'
  | 'seating:read' | 'seating:write'
  | 'schedule:read' | 'schedule:write'
  | 'comms:read' | 'comms:write'
  | 'legal:read' | 'legal:write'
  | 'decisions:read' | 'decisions:write'
  | 'files:read' | 'files:write'
  | 'assistant:use' | 'assistant:apply'
  | 'members:manage' | 'wedding:delete';

/** Which permission reads each collection — mirrors app.table_perms in the database. */
export const READ_PERM: Record<CollName, Permission> = {
  venues: 'venues:read',
  tasks: 'tasks:read',
  budget_categories: 'finance:read',
  budget_lines: 'finance:read',
  payments: 'finance:read',
  vendors: 'vendors:read',
  vendor_finance: 'finance:read',
  guests: 'guests:read',
  guest_contacts: 'guests:contact',
  rsvps: 'guests:read',
  events: 'settings:read',
  rooms: 'travel:read',
  legal_docs: 'legal:read',
  decisions: 'decisions:read',
  seat_tables: 'seating:read',
  schedule_items: 'schedule:read',
  comms_rows: 'comms:read',
  templates: 'comms:read',
  correspondence: 'comms:read',
  attachments: 'files:read',
  faqs: 'comms:read',
};

export const WRITE_PERM: Record<CollName, Permission> = {
  venues: 'venues:write',
  tasks: 'tasks:write',
  budget_categories: 'finance:write',
  budget_lines: 'finance:write',
  payments: 'finance:write',
  vendors: 'vendors:write',
  vendor_finance: 'finance:write',
  guests: 'guests:write',
  guest_contacts: 'guests:write',
  rsvps: 'guests:write',
  events: 'settings:write',
  rooms: 'travel:write',
  legal_docs: 'legal:write',
  decisions: 'decisions:write',
  seat_tables: 'seating:write',
  schedule_items: 'schedule:write',
  comms_rows: 'comms:write',
  templates: 'comms:write',
  correspondence: 'comms:write',
  attachments: 'files:write',
  faqs: 'comms:write',
};

/** Plain-English names for error messages: "You don't have permission to change the budget". */
export const COLL_LABEL: Record<CollName, string> = {
  venues: 'venues',
  tasks: 'the timeline',
  budget_categories: 'the budget',
  budget_lines: 'the budget',
  payments: 'payments',
  vendors: 'vendors',
  vendor_finance: 'vendor quotes and deposits',
  guests: 'the guest list',
  guest_contacts: 'guest contact details',
  rsvps: 'RSVPs',
  events: 'the weekend’s events',
  rooms: 'travel and rooms',
  legal_docs: 'legal documents',
  decisions: 'decisions',
  seat_tables: 'seating',
  schedule_items: 'the run of show',
  comms_rows: 'comms tracking',
  templates: 'message templates',
  correspondence: 'the vendor log',
  attachments: 'attachments',
  faqs: 'the guest FAQ',
};
