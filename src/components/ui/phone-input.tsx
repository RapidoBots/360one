"use client";

import * as React from "react";
import PhoneInputPrimitive from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

function PhoneInput({
  className,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof PhoneInputPrimitive>, "onChange"> & {
  onChange: (value: string) => void;
}) {
  return (
    <PhoneInputPrimitive
      international
      defaultCountry="US"
      className={cn("cn-phone-input h-11 text-base", className)}
      onChange={(value) => onChange(value ?? "")}
      {...props}
    />
  );
}

export { PhoneInput };
