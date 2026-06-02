import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium rounded transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: [
          "border border-[hsl(218_24%_18%)] text-[hsl(210_30%_88%)]",
          "bg-[hsl(218_30%_12%)]",
          "hover:border-[hsl(190_60%_34%)] hover:bg-[hsl(218_30%_14%)] hover:text-[hsl(210_30%_95%)]",
          "hover:-translate-y-px hover:shadow-[0_4px_16px_hsl(218_42%_2%/0.4)]",
        ],
        primary: [
          "bg-gradient-primary text-[hsl(218_42%_5%)] font-semibold border-transparent",
          "shadow-[0_4px_20px_hsl(190_90%_60%/0.22)]",
          "hover:shadow-[0_8px_28px_hsl(190_90%_60%/0.32)] hover:-translate-y-px",
        ],
        success: [
          "bg-gradient-success text-[hsl(152_60%_8%)] font-semibold border-transparent",
          "shadow-[0_4px_20px_hsl(152_72%_52%/0.2)]",
          "hover:shadow-[0_8px_28px_hsl(152_72%_52%/0.3)] hover:-translate-y-px",
        ],
        ghost: [
          "border-transparent bg-transparent text-[hsl(218_16%_52%)]",
          "hover:bg-[hsl(218_28%_12%)] hover:text-[hsl(210_30%_88%)]",
        ],
        destructive: [
          "border-[hsl(356_50%_28%)] bg-[hsl(356_50%_14%)] text-[hsl(356_84%_78%)]",
          "hover:bg-[hsl(356_50%_18%)] hover:shadow-[0_4px_16px_hsl(356_80%_60%/0.2)]",
        ],
        outline: [
          "border border-[hsl(218_24%_18%)] bg-transparent text-[hsl(210_30%_82%)]",
          "hover:border-[hsl(190_60%_30%)] hover:bg-[hsl(218_30%_10%)]",
        ],
        cyan: [
          "border border-[hsl(190_60%_30%/0.5)] bg-[hsl(190_60%_16%/0.4)] text-[hsl(190_90%_72%)]",
          "hover:bg-[hsl(190_60%_20%/0.5)] hover:border-[hsl(190_60%_40%/0.6)]",
        ],
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-sm",
        default: "h-9 px-4",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
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
