import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef(({
  className,
  size = "default",
  ...props
}, ref) => (
  <div
    ref={ref}
    data-slot="card"
    data-size={size}
    className={cn(
      "group/card flex flex-col gap-6 overflow-hidden rounded-xl bg-card py-6 text-sm text-card-foreground shadow-xs ring-1 ring-foreground/10 has-[>img:first-child]:pt-0 data-[size=sm]:gap-4 data-[size=sm]:py-4 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef(({
  className,
  ...props
}, ref) => (
  <div
    ref={ref}
    data-slot="card-header"
    className={cn(
      "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-6 group-data-[size=sm]/card:px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-6 group-data-[size=sm]/card:[.border-b]:pb-4",
      className
    )}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({
  className,
  ...props
}, ref) => (
  <div
    ref={ref}
    data-slot="card-title"
    className={cn(
      "font-heading text-base leading-normal font-medium group-data-[size=sm]/card:text-sm",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef(({
  className,
  ...props
}, ref) => (
  <div
    ref={ref}
    data-slot="card-description"
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardAction = React.forwardRef(({
  className,
  ...props
}, ref) => (
  <div
    ref={ref}
    data-slot="card-action"
    className={cn(
      "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
      className
    )}
    {...props}
  />
))
CardAction.displayName = "CardAction"

const CardContent = React.forwardRef(({
  className,
  ...props
}, ref) => (
  <div
    ref={ref}
    data-slot="card-content"
    className={cn("px-6 group-data-[size=sm]/card:px-4", className)}
    {...props}
  />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(({
  className,
  ...props
}, ref) => (
  <div
    ref={ref}
    data-slot="card-footer"
    className={cn(
      "flex items-center rounded-b-xl px-6 group-data-[size=sm]/card:px-4 [.border-t]:pt-6 group-data-[size=sm]/card:[.border-t]:pt-4",
      className
    )}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
