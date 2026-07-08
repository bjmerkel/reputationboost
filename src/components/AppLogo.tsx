import Image from "next/image";
import { APP_LOGO_SRC } from "@/lib/constants";

interface AppLogoProps {
  className?: string;
  priority?: boolean;
}

/** Brand mark from public/Logo.jpeg (148×86). */
export default function AppLogo({ className = "h-9 w-auto", priority = false }: AppLogoProps) {
  return (
    <Image
      src={APP_LOGO_SRC}
      alt="Reputation Boost"
      width={148}
      height={86}
      priority={priority}
      className={`rounded-md object-contain ${className}`}
    />
  );
}
