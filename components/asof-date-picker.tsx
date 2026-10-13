
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

export function AsOfDatePicker() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentDate = searchParams.get("asof") || todayInIndia();
  const [date, setDate] = useState(currentDate);

  function applyDate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams(searchParams.toString());
    params.set("asof", date);

    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form
      onSubmit={applyDate}
      className="no-print"
      style={{ display: "flex", alignItems: "flex-end", gap: 8 }}
    >
      <label>
        AS-AT DATE
        <input
          aria-label="As-at date"
          type="date"
          name="asof"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </label>
      <button className="primary" type="submit">
        Apply
      </button>
    </form>
  );
}
