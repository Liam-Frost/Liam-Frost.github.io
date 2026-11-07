import { useLayoutEffect, useState, type ComponentPropsWithRef } from "react";
import "./loading-skeleton.css";
/** Preserve the image's existing dimensions and layout while its pixels arrive. */
export default function LoadingImage({
  className,
  onLoad,
  onError,
  ...props
}: ComponentPropsWithRef<"img">) {
  const [pending, setPending] = useState(true);
  useLayoutEffect(() => setPending(true), [props.src]);
  return (
    <img
      {...props}
      className={[className, pending ? "loadingSkeleton-image" : ""].filter(Boolean).join(" ")}
      onLoad={(event) => {
        setPending(false);
        onLoad?.(event);
      }}
      onError={(event) => {
        setPending(false);
        onError?.(event);
      }}
    />
  );
}
