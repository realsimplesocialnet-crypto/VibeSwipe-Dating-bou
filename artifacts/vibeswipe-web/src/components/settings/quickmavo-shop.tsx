import { ExternalLink, ShoppingBag } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function QuickmavoShopMenuItem() {
  return <AlertDialog>
    <AlertDialogTrigger asChild>
      <button type="button" data-testid="button-quickmavo-shop" className="flex min-h-[64px] w-full items-center gap-4 py-4 text-left transition-colors hover:text-primary">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><ShoppingBag size={18}/></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Quickmavo Shop</span>
          <span className="mt-1 block text-xs text-muted-foreground">Numbers, followers, eSIM &amp; airtime</span>
        </span>
        <ExternalLink size={17} className="shrink-0 text-muted-foreground"/>
      </button>
    </AlertDialogTrigger>
    <AlertDialogContent className="w-[calc(100%_-_2rem)] rounded-2xl" data-testid="dialog-quickmavo-confirm">
      <AlertDialogHeader>
        <AlertDialogTitle>Open Quickmavo Shop?</AlertDialogTitle>
        <AlertDialogDescription>You are about to leave this app and go to Quickmavo.com. Continue?</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel data-testid="button-quickmavo-cancel">Cancel</AlertDialogCancel>
        <AlertDialogAction asChild>
          <a href="https://quickmavo.com" target="_blank" rel="noopener noreferrer" data-testid="button-quickmavo-continue">Continue</a>
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
