import { HomeScreen } from "@/modules/catalog";
import { catalogQueries } from "@/modules/catalog/server";

export default async function Home() {
  const view = await catalogQueries.getHomePage();

  return <HomeScreen view={view} />;
}
