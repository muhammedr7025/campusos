export type LeadRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  status: "NEW" | "CONTACTED" | "INTERESTED" | "FOLLOW_UP" | "CONVERTED" | "LOST";
  lostReason: string | null;
  courseName: string | null;
  counselorName: string | null;
  createdAt: string;
  isOverdue: boolean;
};
