// src/components/ui/link.tsx
"use client"

import NextLink, { type LinkProps as NextLinkProps } from "next/link"
import * as React from "react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

interface LinkProps extends NextLinkProps, React.HTMLAttributes<HTMLAnchorElement> {
  variant?: NonNullable<React.ComponentProps<typeof Button>>["variant"]
  size?: NonNullable<React.ComponentProps<typeof Button>>["size"]
  disabled?: boolean
  isActive?: boolean
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  (
    {
      className,
      href,
      variant = "link",
      size = "default",
      disabled = false,
      isActive = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <NextLink
        ref={ref}
        href={href}
        className={cn(
          buttonVariants({ variant, size, className }),
          disabled && "pointer-events-none opacity-50",
          isActive && "font-semibold text-primary data-[variant=link]:underline"
        )}
        aria-disabled={disabled}
        {...props}
      >
        {children}
      </NextLink>
    )
  }
)
Link.displayName = "Link"

export { Link, type LinkProps }
