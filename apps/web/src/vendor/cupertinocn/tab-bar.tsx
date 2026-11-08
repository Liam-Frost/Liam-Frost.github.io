import { mergeProps } from "@base-ui/react/merge-props";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "../../lib/cn";
import { GlassSurface, LiquidGlass, type GlassVariant } from "./liquid-glass";
import { useTabGestures } from "./tab-gestures";
import "./cupertino-glass.css";

/**
 * CupertinoCN's Tab Bar (see README.md for the differences). The tabs are links here: the Base UI
 * tab list keeps the indicator and the composite, while the roles are those of site navigation.
 */
function TabBar({
  className,
  ...props
}: Omit<TabsPrimitive.Root.Props, "className"> & { className?: string }) {
  return (
    <TabsPrimitive.Root data-slot="tab-bar" className={cn("cupertino", className)} {...props} />
  );
}

const listClass = "cupertino-tab-list";

/**
 * A floating glass bar. `className` shapes and positions the bar. The selection lens springs
 * between tabs and follows a drag. It refracts a highlighted copy of the tabs, so the item under the
 * lens appears selected and bent in every browser. The copy is inert and hidden from assistive
 * technology.
 */
function TabBarList({
  className,
  children,
  variant = "regular",
  strength = 1,
  lensStrength = 0.9,
  lensRim = 0.3,
  ...props
}: Omit<TabsPrimitive.List.Props, "className"> & {
  className?: string;
  variant?: GlassVariant;
  strength?: number;
  lensStrength?: number;
  lensRim?: number;
}) {
  const gestures = useTabGestures();
  return (
    <LiquidGlass variant={variant} strength={strength} interactive={false} className={className}>
      <TabsPrimitive.List
        data-slot="tab-bar-list"
        className={listClass}
        // A plain group of links inside the page's <nav>.
        role={undefined}
        aria-orientation={undefined}
        {...mergeProps(gestures, props)}
      >
        <TabsPrimitive.Indicator className="cupertino-tab-indicator">
          <GlassSurface
            variant="clear"
            strength={lensStrength}
            rim={lensRim}
            interactive={false}
            refract={
              <TabsPrimitive.Root
                aria-hidden="true"
                inert
                data-glass-copy=""
                className={cn("cupertino-tab-copy", listClass)}
                render={<TabsPrimitive.List role={undefined} />}
              >
                {children}
              </TabsPrimitive.Root>
            }
          />
        </TabsPrimitive.Indicator>
        {children}
      </TabsPrimitive.List>
    </LiquidGlass>
  );
}

function TabBarTrigger({
  className,
  ...props
}: Omit<TabsPrimitive.Tab.Props, "className"> & { className?: string }) {
  return (
    <TabsPrimitive.Tab
      data-slot="tab-bar-trigger"
      className={cn("cupertino-tab-trigger", className)}
      {...props}
    />
  );
}

export { TabBar, TabBarList, TabBarTrigger };
