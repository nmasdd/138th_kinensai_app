import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import {
  parseCsvText,
  formatCsvText,
  buildTimeSlots,
  buildExhibition,
  loadCsvFromBundle,
  loadCsvFromStorage,
  writeCsvToStorage,
} from '../utils/csvLoader';
import { loadAllClassContent } from '../data/classContent';
import type { Exhibition, DayType } from '../utils/types';
import type { ClassContent } from '../data/classContent';

export interface ReservationRecord {
  exhibitionId: string;
  slotIndex: number;
  peopleCount: number;
  className: string;
  projectName: string;
  day: '土曜日' | '日曜日';
  reservedAt: string;
}

interface SlotMeta {
  timeValues: string[];
  capacity: number;
}

interface ReservationContextType {
  exhibitions: Exhibition[];
  isLoading: boolean;
  reservations: ReservationRecord[];
  reserve: (exhibition: Exhibition, slotIndex: number, peopleCount: number) => void;
  cancel: (exhibitionId: string, slotIndex: number) => void;
  isReserved: (exhibitionId: string, slotIndex: number) => boolean;
  effectiveReserved: (exhibition: Exhibition, slotIndex: number) => number;
}

const ReservationContext = createContext<ReservationContextType | null>(null);

const RESERVATIONS_FILE = `${FileSystem.documentDirectory}reservations.json`;

const CLASS_NAMES = ['1A', '1B', '1C'] as const;
const DAYS: DayType[] = ['saturday', 'sunday'];

type AssetMap = Record<string, Record<string, any>>;

const dayCsvAssets: AssetMap = {
  saturday: {
    '1A': require('../../reservation/1A/saturday.csv'),
    '1B': require('../../reservation/1B/saturday.csv'),
    '1C': require('../../reservation/1C/saturday.csv'),
  },
  sunday: {
    '1A': require('../../reservation/1A/sunday.csv'),
    '1B': require('../../reservation/1B/sunday.csv'),
    '1C': require('../../reservation/1C/sunday.csv'),
  },
};

function slotKey(exhibitionId: string, slotIndex: number): string {
  return `${exhibitionId}_slot_${slotIndex}`;
}

async function loadJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      const content = await FileSystem.readAsStringAsync(path);
      return JSON.parse(content) as T;
    }
  } catch (e) {
    console.error('JSON読み込み失敗:', path, e);
  }
  return fallback;
}

async function saveJson(path: string, data: unknown): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(path, JSON.stringify(data), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch (e) {
    console.error('JSON保存失敗:', path, e);
  }
}

function buildExhibitionFromCsv(
  className: string,
  day: DayType,
  timeValues: string[],
  capacity: number,
  reservedCounts: number[],
  content: ClassContent,
): Exhibition {
  const timeSlots = buildTimeSlots(timeValues, capacity, reservedCounts);
  return buildExhibition(day, className, content.title, content.detail, timeSlots);
}

export function ReservationProvider({ children }: { children: React.ReactNode }) {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);

  const metasRef = useRef(new Map<string, SlotMeta>());
  // Track whether init has been done to avoid re-executing the merge
  const initDoneRef = useRef(false);

  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    const init = async () => {
      try {
        const loaded: Exhibition[] = [];
        const reservationsData = await loadJson<ReservationRecord[]>(RESERVATIONS_FILE, []);
        const classContent = await loadAllClassContent();

        for (const className of CLASS_NAMES) {
          const content = classContent[className];

          for (const day of DAYS) {
            let csvText = await loadCsvFromStorage(className, day);
            let needWrite = false;

            if (!csvText) {
              csvText = await loadCsvFromBundle(dayCsvAssets[day][className]);
              needWrite = true;
            }

            const { timeValues, capacity, reservedCounts } = parseCsvText(csvText);
            let finalCounts = [...reservedCounts];

            if (needWrite) {
              // First run: apply any existing reservations.json deltas on top of bundle counts
              const exId = `${day === 'saturday' ? '土曜日' : '日曜日'}_${className}`;
              for (const rec of reservationsData) {
                if (rec.exhibitionId === exId) {
                  finalCounts[rec.slotIndex] = (finalCounts[rec.slotIndex] ?? 0) + rec.peopleCount;
                }
              }
            }

            const exhibition = buildExhibitionFromCsv(className, day, timeValues, capacity, finalCounts, content);
            metasRef.current.set(exhibition.id, { timeValues, capacity });

            if (needWrite) {
              const csvTextMerged = formatCsvText(timeValues, capacity, finalCounts);
              await writeCsvToStorage(className, day, csvTextMerged);
            }

            loaded.push(exhibition);
          }
        }

        setExhibitions(loaded);
        setReservations(reservationsData);
      } catch (error) {
        console.error('データ初期化に失敗しました:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveJson(RESERVATIONS_FILE, reservations);
    }
  }, [reservations, isLoading]);

  const reservationSet = useMemo(
    () => new Set(reservations.map((r) => slotKey(r.exhibitionId, r.slotIndex))),
    [reservations],
  );

  const isReserved = useCallback(
    (exhibitionId: string, slotIndex: number) => {
      return reservationSet.has(slotKey(exhibitionId, slotIndex));
    },
    [reservationSet],
  );

  const effectiveReserved = useCallback(
    (exhibition: Exhibition, slotIndex: number) => {
      return exhibition.timeSlots[slotIndex]?.reservedCount ?? 0;
    },
    [],
  );

  const reserve = useCallback(
    (exhibition: Exhibition, slotIndex: number, peopleCount: number) => {
      if (reservationSet.has(slotKey(exhibition.id, slotIndex))) return;

      const record: ReservationRecord = {
        exhibitionId: exhibition.id,
        slotIndex,
        peopleCount,
        className: exhibition.className,
        projectName: exhibition.projectName,
        day: exhibition.day === 'saturday' ? '土曜日' : '日曜日',
        reservedAt: new Date().toISOString(),
      };

      const day = exhibition.day;
      const className = exhibition.className;
      const meta = metasRef.current.get(exhibition.id);

      setReservations((prev) => [...prev, record]);

      if (meta) {
        setExhibitions((prev) => {
          const updated = prev.map((ex) => {
            if (ex.id !== exhibition.id) return ex;
            return {
              ...ex,
              timeSlots: ex.timeSlots.map((slot, i) =>
                i === slotIndex
                  ? { ...slot, reservedCount: slot.reservedCount + peopleCount }
                  : slot,
              ),
            };
          });

          const target = updated.find((ex) => ex.id === exhibition.id);
          if (target) {
            const newCounts = target.timeSlots.map((s) => s.reservedCount);
            const csvText = formatCsvText(meta.timeValues, meta.capacity, newCounts);
            writeCsvToStorage(className, day, csvText);
          }

          return updated;
        });
      }
    },
    [reservationSet],
  );

  const cancel = useCallback(
    (exhibitionId: string, slotIndex: number) => {
      const target = reservations.find(
        (r) => r.exhibitionId === exhibitionId && r.slotIndex === slotIndex,
      );
      const removedCount = target?.peopleCount ?? 0;

      setReservations((prev) =>
        prev.filter(
          (r) => !(r.exhibitionId === exhibitionId && r.slotIndex === slotIndex),
        ),
      );

      if (removedCount <= 0) return;

      const meta = metasRef.current.get(exhibitionId);
      if (!meta) return;

      setExhibitions((prev) => {
        const updated = prev.map((ex) => {
          if (ex.id !== exhibitionId) return ex;
          return {
            ...ex,
            timeSlots: ex.timeSlots.map((slot, i) =>
              i === slotIndex
                ? { ...slot, reservedCount: Math.max(0, slot.reservedCount - removedCount) }
                : slot,
            ),
          };
        });

        const targetEx = updated.find((ex) => ex.id === exhibitionId);
        if (targetEx) {
          const newCounts = targetEx.timeSlots.map((s) => s.reservedCount);
          const csvText = formatCsvText(meta.timeValues, meta.capacity, newCounts);
          writeCsvToStorage(targetEx.className, targetEx.day, csvText);
        }

        return updated;
      });
    },
    [reservations],
  );

  return (
    <ReservationContext.Provider
      value={{ exhibitions, isLoading, reservations, reserve, cancel, isReserved, effectiveReserved }}
    >
      {children}
    </ReservationContext.Provider>
  );
}

export function useReservation() {
  const context = useContext(ReservationContext);
  if (!context) {
    throw new Error('useReservation は ReservationProvider の内部で使用する必要があります');
  }
  return context;
}
