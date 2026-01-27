import type { Contact } from "@/hooks/useContactsSupabase";

/**
 * Generates a vCard string for a single contact
 */
function generateVCard(contact: Contact): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${contact.name}`,
    `TEL;TYPE=CELL:${contact.phone}`,
  ];

  if (contact.email) {
    lines.push(`EMAIL:${contact.email}`);
  }

  if (contact.notes) {
    // Escape special characters in notes
    const escapedNotes = contact.notes
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
    lines.push(`NOTE:${escapedNotes}`);
  }

  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/**
 * Exports a single contact as a .vcf file
 */
export function exportContactAsVCard(contact: Contact): void {
  const vcard = generateVCard(contact);
  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `${contact.name.replace(/[^a-zA-Z0-9]/g, "_")}.vcf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports multiple contacts as a single .vcf file
 */
export function exportContactsAsVCard(contacts: Contact[]): void {
  if (contacts.length === 0) return;
  
  const vcards = contacts.map(generateVCard).join("\r\n");
  const blob = new Blob([vcards], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `contatos_${new Date().toISOString().split("T")[0]}.vcf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
