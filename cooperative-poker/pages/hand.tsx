import { useEffect } from "react";
import { useRouter } from "next/router";

export default function HandPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/home");
  }, [router]);
  return null;
}
