import { catalogQueries, HomeScreen } from "@/modules/catalog";

export default async function Home() {
  const view = await catalogQueries.getHomePage();

  return <HomeScreen view={view} />;
}
