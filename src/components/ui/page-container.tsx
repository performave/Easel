import { cn } from "@/lib/utils"

/** Standard centered page wrapper with consistent max-width, padding, and spacing. */
function PageContainer({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "wide" | "narrow" }) {
  return (
    <div
      data-slot="page-container"
      className={cn(
        "mx-auto w-full space-y-6 p-6",
        size === "narrow" && "max-w-4xl",
        size === "default" && "max-w-6xl",
        size === "wide" && "max-w-7xl",
        className
      )}
      {...props}
    />
  )
}

export { PageContainer }
