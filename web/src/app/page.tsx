import dynamic from "next/dynamic";

const LandingPage = dynamic(() => import("./landing/landing-page"), {
  ssr: false,
});

export default function HomePage() {
  return <LandingPage />;
}
