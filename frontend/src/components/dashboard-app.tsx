"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { DashboardScreen } from "@/components/dashboard-screen";
import { FeeCalculator } from "@/components/fee-calculator";
import { buildApiClient } from "@/lib/api";
import {
  readStoredDashboardSelection,
  writeStoredDashboardSelection,
} from "@/lib/dashboard-preferences";
import { formatDateTimeWithZone } from "@/lib/format";
import type {
  Airport,
  CollectorStatusResponse,
  ParkingStatus,
  ParkingTimeSeriesResponse,
  ThresholdEvent,
  ThresholdInsightsResponse,
  WeekdayHourlyPattern,
} from "@/lib/types";

type DashboardAppProps = {
  apiBaseUrl?: string;
};

function useViewportMode() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function syncViewport() {
      setIsMobile(window.innerWidth < 860);
    }

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  return isMobile;
}

function buildCollectorCooldownMessage(status: CollectorStatusResponse): string {
  const cooldownMinutes = Math.max(1, Math.round(status.manual_collect_min_interval_seconds / 60));
  if (status.manual_collect_available_at) {
    return `마지막 업데이트 후 ${cooldownMinutes}분이 지나지 않았습니다. ${formatDateTimeWithZone(status.manual_collect_available_at)} 이후 다시 시도해 주세요.`;
  }
  return `마지막 업데이트 후 ${cooldownMinutes}분이 지나지 않았습니다. 잠시 후 다시 시도해 주세요.`;
}

export function DashboardApp({ apiBaseUrl }: DashboardAppProps) {
  const api = useMemo(() => buildApiClient(apiBaseUrl), [apiBaseUrl]);
  const isMobile = useViewportMode();
  const [airports, setAirports] = useState<Airport[]>([]);
  const [selectedAirportCode, setSelectedAirportCode] = useState("");
  const [selectedParkingLotId, setSelectedParkingLotId] = useState<number | null>(null);
  const [currentItems, setCurrentItems] = useState<ParkingStatus[]>([]);
  const [thresholdEvents, setThresholdEvents] = useState<ThresholdEvent[]>([]);
  const [thresholdInsights, setThresholdInsights] = useState<ThresholdInsightsResponse | null>(null);
  const [weekdayHourlyPatterns, setWeekdayHourlyPatterns] = useState<WeekdayHourlyPattern[]>([]);
  const [timeSeries, setTimeSeries] = useState<ParkingTimeSeriesResponse | null>(null);
  const [collectorStatus, setCollectorStatus] = useState<CollectorStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionMessageIsError, setActionMessageIsError] = useState(false);

  async function loadAirportData(airportCode: string, parkingLotId: number | null = null) {
    setLoading(true);
    setError(null);

    try {
      const [current, thresholds, thresholdDetail, weekdayHourly, timeseries, status] = await Promise.all([
        api.getCurrent(airportCode),
        api.getThresholdEvents(airportCode, parkingLotId),
        api.getThresholdInsights(airportCode, { parkingLotId }),
        api.getByWeekdayHour(airportCode, parkingLotId),
        api.getTimeSeries(airportCode, { parkingLotId }),
        api.getCollectorStatus(),
      ]);
      setCurrentItems(current.items);
      setThresholdEvents(thresholds);
      setThresholdInsights(thresholdDetail);
      setWeekdayHourlyPatterns(weekdayHourly);
      setTimeSeries(timeseries);
      setCollectorStatus(status);
    } catch (caughtError) {
      setActionMessageIsError(true);
      setError(caughtError instanceof Error ? caughtError.message : "대시보드 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const loadedAirports = await api.getAirports();
        if (!active) {
          return;
        }

        setAirports(loadedAirports);
        const storedSelection = readStoredDashboardSelection();
        const initialAirport =
          loadedAirports.find((airport) => airport.code === storedSelection?.airportCode) ?? loadedAirports[0] ?? null;
        const initialParkingLotId =
          storedSelection?.parkingLotId != null &&
          initialAirport?.parking_lots.some(
            (parkingLot) => parkingLot.is_active && parkingLot.id === storedSelection.parkingLotId
          )
            ? storedSelection.parkingLotId
            : null;
        const initialAirportCode = initialAirport?.code ?? "";

        setSelectedAirportCode(initialAirportCode);
        setSelectedParkingLotId(initialParkingLotId);

        if (initialAirportCode) {
          await loadAirportData(initialAirportCode, initialParkingLotId);
        } else {
          setLoading(false);
        }
      } catch (caughtError) {
        if (!active) {
          return;
        }

        setError(caughtError instanceof Error ? caughtError.message : "공항 목록을 불러오지 못했습니다.");
        setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    if (!selectedAirportCode) {
      return;
    }

    writeStoredDashboardSelection({
      airportCode: selectedAirportCode,
      parkingLotId: selectedParkingLotId,
    });
  }, [selectedAirportCode, selectedParkingLotId]);

  const selectedAirport = useMemo(
    () => airports.find((airport) => airport.code === selectedAirportCode) ?? null,
    [airports, selectedAirportCode]
  );
  const selectedAirportLots = selectedAirport?.parking_lots.filter((parkingLot) => parkingLot.is_active) ?? [];
  const selectedParkingLot = selectedAirportLots.find((parkingLot) => parkingLot.id === selectedParkingLotId) ?? null;

  const scopeItems = useMemo(
    () => currentItems.filter((item) => selectedParkingLotId === null || item.parking_lot_id === selectedParkingLotId),
    [currentItems, selectedParkingLotId]
  );

  async function handleManualCollect() {
    setActionMessage(null);
    setActionMessageIsError(false);
    setError(null);

    if (collectorStatus?.manual_collect_blocked) {
      setActionMessage(buildCollectorCooldownMessage(collectorStatus));
      setActionMessageIsError(true);
      return;
    }

    try {
      setCollecting(true);
      const summary = await api.runCollector();
      await loadAirportData(selectedAirportCode, selectedParkingLotId);
      setActionMessageIsError(false);
      setActionMessage(`즉시 수집을 완료했습니다. 신규 스냅샷 ${summary.snapshot_count}건을 저장했습니다.`);
    } catch (caughtError) {
      setActionMessageIsError(true);
      setActionMessage(caughtError instanceof Error ? caughtError.message : "즉시 수집 실행에 실패했습니다.");
    } finally {
      setCollecting(false);
    }
  }

  return (
    <>
      <DashboardScreen
        airports={airports}
        parkingLots={selectedAirportLots}
        selectedAirportCode={selectedAirportCode}
        selectedParkingLotId={selectedParkingLotId}
        selectedParkingLotName={selectedParkingLot?.name ?? null}
        scopeItems={scopeItems}
        currentItems={scopeItems}
        thresholdEvents={thresholdEvents}
        thresholdInsights={thresholdInsights}
        weekdayHourlyPatterns={weekdayHourlyPatterns}
        timeSeries={timeSeries}
        collectorStatus={collectorStatus}
        isMobile={isMobile}
        loading={loading}
        collecting={collecting}
        error={error}
        actionMessage={actionMessage}
        actionMessageIsError={actionMessageIsError}
        onAirportChange={(airportCode) => {
          startTransition(() => {
            setSelectedAirportCode(airportCode);
            setSelectedParkingLotId(null);
            setActionMessage(null);
            setActionMessageIsError(false);
          });
          void loadAirportData(airportCode, null);
        }}
        onParkingLotChange={(parkingLotId) => {
          startTransition(() => {
            setSelectedParkingLotId(parkingLotId);
            setActionMessage(null);
            setActionMessageIsError(false);
          });
          void loadAirportData(selectedAirportCode, parkingLotId);
        }}
        onRefresh={() => {
          setActionMessage(null);
          setActionMessageIsError(false);
          if (selectedAirportCode) {
            void loadAirportData(selectedAirportCode, selectedParkingLotId);
          }
        }}
        onManualCollect={() => {
          if (selectedAirportCode) {
            void handleManualCollect();
          }
        }}
      />
      {airports.length > 0 ? (
        <div className="page-shell footer-band">
          <FeeCalculator
            airports={airports}
            initialAirportCode={selectedAirportCode || airports[0].code}
            onCalculate={api.calculateFee}
          />
        </div>
      ) : null}
    </>
  );
}
