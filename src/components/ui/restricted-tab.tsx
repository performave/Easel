import { IconLock } from "@tabler/icons-react"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

/** Shared fallback shown when a Canvas tab/section is restricted for the account. */
function RestrictedTab({
  message = "This tab is restricted for your account.",
}: {
  message?: string
}) {
  return (
    <Empty className="border-none">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconLock />
        </EmptyMedia>
        <EmptyTitle>Restricted</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export { RestrictedTab }
