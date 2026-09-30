import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: [
          "border border-border text-foreground bg-secondary",
          "hover:border-primary/40 hover:bg-muted hover:text-foreground",
          "hover:shadow-[0_3px_12px_hsl(218_42%_2%/0.28)]",
        ],
        primary: [
          "bg-primary text-primary-foreground font-semibold border border-primary/80",
          "shadow-[0_3px_14px_hsl(190_90%_60%/0.18)]",
          "hover:bg-primary/90 hover:shadow-[0_5px_18px_hsl(190_90%_60%/0.24)]",
        ],
        success: [
          "bg-gradient-success text-[hsl(152_60%_8%)] font-semibold border-transparent",
          "shadow-[0_4px_20px_hsl(152_72%_52%/0.2)]",
          "hover:shadow-[0_5px_20px_hsl(152_72%_52%/0.25)]",
        ],
        ghost: [
          "border-transparent bg-transparent text-muted-foreground",
          "hover:bg-muted hover:text-foreground",
        ],
        destructive: [
          "border-destructive/40 bg-destructive/15 text-destructive",
          "hover:bg-[hsl(356_50%_18%)] hover:shadow-[0_4px_16px_hsl(356_80%_60%/0.2)]",
        ],
        outline: [
          "border border-border bg-transparent text-foreground",
          "hover:border-primary/40 hover:bg-muted",
        ],
        cyan: [
          "border border-primary/40 bg-accent text-accent-foreground",
          "hover:bg-primary/15 hover:border-primary/60",
        ],
      },
      size: {
        sm: "h-[34px] px-3 text-xs rounded-sm",
        default: "h-9 px-4",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-[34px] w-[34px] p-0",
        "icon-lg": "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
