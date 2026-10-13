"use client";

/** A checkbox that submits its form as soon as it is ticked or unticked (no Apply button needed). */
export function AutoSubmitCheckbox({
  name,
  value,
  defaultChecked,
}: {
  name: string;
  value: string;
  defaultChecked?: boolean;
}) {
  return (
    <input
      type="checkbox"
      className="big-checkbox"
      name={name}
      value={value}
      defaultChecked={defaultChecked}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    />
  );
}
