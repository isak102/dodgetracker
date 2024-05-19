"use client";

import { sendGTMEvent } from "@next/third-parties/google";
import { useLocalStorage } from "@uidotdev/usehooks";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { MdDone } from "react-icons/md";
import { autoFetchKey } from "../autoFetch";
import { cn } from "../lib/utils";
import LoadingSpinner from "./LoadingSpinner";
import { Button } from "./ui/button";

const updateIntervalSecs = 15;

export interface RefreshButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export default function RefreshButton({
  className,
  ...props
}: RefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [autoFetch, _setAutoFetch] = useLocalStorage(autoFetchKey, false);
  const [buttonClicked, setButtonClicked] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const interval = useRef<number | null>(null);

  // Fetch new dodges
  const fetch = useCallback(
    (eventName: string) => {
      console.log("fetching");
      setButtonClicked(true);
      startTransition(() => {
        router.refresh();
        setIsDone(true);
      });

      sendGTMEvent({ event: eventName });
      posthog.capture(eventName);
    },
    [setButtonClicked, startTransition, router, setIsDone],
  );

  const setInterval = useCallback(() => {
    interval.current = window.setInterval(() => {
      fetch("auto_fetch");
    }, updateIntervalSecs * 1000);
  }, [fetch]);

  // Reset interval
  const resetInterval = () => {
    if (autoFetch && interval.current) {
      window.clearInterval(interval.current);
      setInterval();
    }
  };

  // Start an interval when autoFetch is enabled, clear it when disabled
  useEffect(() => {
    if (autoFetch) {
      setInterval();
    } else {
      if (interval.current) {
        window.clearInterval(interval.current);
      }
    }

    return () => {
      if (interval.current) {
        window.clearInterval(interval.current);
      }
    };
  }, [autoFetch, fetch, setInterval]);

  // Reset button state after a short delay
  useEffect(() => {
    if (!isPending && buttonClicked) {
      const timeoutId = setTimeout(() => {
        setIsDone(false);
        setButtonClicked(false);
      }, 250);
      return () => clearTimeout(timeoutId);
    }
  }, [isPending, buttonClicked]);

  return (
    <Button
      disabled={isPending || isDone}
      variant={"secondary"}
      className={cn(
        "min-h-8 min-w-16 text-lg md:min-h-10 md:min-w-20",
        className,
      )}
      onClick={() => {
        fetch("fetch_clicked");
        resetInterval();
      }}
      {...props}
    >
      <div className="flex items-center justify-center">
        {isPending ? (
          <div className="size-5 md:size-7">
            <LoadingSpinner />
          </div>
        ) : isDone ? (
          <div className="text-xl md:text-2xl">
            <MdDone />
          </div>
        ) : (
          "Fetch"
        )}
      </div>
    </Button>
  );
}
