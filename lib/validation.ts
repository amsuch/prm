export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export function validatePhone(phone: string): boolean {
  // Allow digits, spaces, dashes, parens, plus sign, dots. Min 7 chars of actual digits.
  const digitsOnly = phone.replace(/[^0-9]/g, "");
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isRequired(value: string | null | undefined): boolean {
  return !!value && value.trim().length > 0;
}

export type ValidationError = {
  field: string;
  message: string;
};

export type ContactFormData = {
  first_name: string;
  last_name: string;
  company: string;
  job_title: string;
  department: string;
  birthday: string;
  notes: string;
  emails: { label: string; email: string; is_primary: boolean }[];
  phones: { label: string; phone: string; is_primary: boolean }[];
  urls: { label: string; url: string }[];
  tagIds: string[];
  custom_fields: Record<string, unknown>;
};

export function validateContactForm(data: ContactFormData): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isRequired(data.first_name)) {
    errors.push({ field: "first_name", message: "First name is required" });
  }

  data.emails.forEach((e, i) => {
    if (e.email.trim() && !validateEmail(e.email)) {
      errors.push({
        field: `email_${i}`,
        message: `Email "${e.email}" is not valid`,
      });
    }
  });

  data.phones.forEach((p, i) => {
    if (p.phone.trim() && !validatePhone(p.phone)) {
      errors.push({
        field: `phone_${i}`,
        message: `Phone "${p.phone}" is not valid`,
      });
    }
  });

  data.urls.forEach((u, i) => {
    if (u.url.trim() && !validateUrl(u.url)) {
      errors.push({
        field: `url_${i}`,
        message: `URL "${u.url}" is not valid`,
      });
    }
  });

  return errors;
}
