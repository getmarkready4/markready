import type { ComponentType } from "react";
import { AshdownMuseumChart } from "./AshdownMuseumChart";
import { Co2EmissionsChart } from "./Co2EmissionsChart";
import { WaterUsageChart } from "./WaterUsageChart";
import { PoliceBudgetChart } from "./PoliceBudgetChart";
import { WeeklySpendingChart } from "./WeeklySpendingChart";
import { ShopClosuresChart } from "./ShopClosuresChart";
import { LanguagesChart } from "./LanguagesChart";
import { NutrientsChart } from "./NutrientsChart";
import { ExportEarningsChart } from "./ExportEarningsChart";
import { CoffeeTeaChart } from "./CoffeeTeaChart";
import { CaribbeanTouristsChart } from "./CaribbeanTouristsChart";
import { AnthropologyChart } from "./AnthropologyChart";
import { UrbanPopulationChart } from "./UrbanPopulationChart";
import { HouseholdsIncomeChart } from "./HouseholdsIncomeChart";
import { MetalPricesChart } from "./MetalPricesChart";
import { ApplianceHouseworkChart } from "./ApplianceHouseworkChart";

// Keyed by the Task 1 Academic sample-question id in score/page.tsx.
export const SAMPLE_CHARTS: Record<string, ComponentType> = {
  // Cambridge 11 Academic (museum, water, co2 are the real Cam 11 tasks)
  museum: AshdownMuseumChart,
  co2: Co2EmissionsChart,
  water: WaterUsageChart,
  languages: LanguagesChart,
  // Cambridge 14 Academic
  nutrients: NutrientsChart,
  exports: ExportEarningsChart,
  // Cambridge 15 Academic
  coffee: CoffeeTeaChart,
  caribbean: CaribbeanTouristsChart,
  anthropology: AnthropologyChart,
  // Cambridge 18 Academic
  urban: UrbanPopulationChart,
  households: HouseholdsIncomeChart,
  metals: MetalPricesChart,
  // Cambridge 16 Academic
  appliances: ApplianceHouseworkChart,
  // Cambridge 17
  police: PoliceBudgetChart,
  spending: WeeklySpendingChart,
  shops: ShopClosuresChart,
};
