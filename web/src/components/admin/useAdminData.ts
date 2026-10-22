"use client";

import { useCallback, useEffect, useState } from "react";
import { getClasses, getSlots } from "@/lib/api";
import type { ClassRoom, Slot } from "@/lib/api";
import { errorText } from "@/lib/format";
import { getChangeRequests, getUsers, useTide } from "@/lib/tide";
import type { ChangeRequest, DirectoryUser } from "@/lib/tide";

export type AdminData = ReturnType<typeof useAdminData>;

export function useAdminData() {
  const { user } = useTide();
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [tideError, setTideError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const loadTide = useCallback(async () => {
    try {
      const [userList, requestList] = await Promise.all([getUsers(), getChangeRequests()]);
      setUsers(userList);
      setRequests(requestList);
      setTideError(null);
    } catch (error) {
      setTideError(errorText(error));
    }
  }, []);

  const loadApi = useCallback(async () => {
    try {
      const [slotList, classList] = await Promise.all([getSlots(), getClasses()]);
      setSlots(slotList);
      setClasses(classList);
      setApiError(null);
    } catch (error) {
      setApiError(errorText(error));
    }
  }, []);

  const reload = useCallback(async () => {
    await Promise.all([loadTide(), loadApi()]);
  }, [loadTide, loadApi]);

  useEffect(() => {
    reload();
    const timer = setInterval(loadTide, 5000);
    return () => clearInterval(timer);
  }, [reload, loadTide, user?.username]);

  const names = Object.fromEntries(users.map((item) => [item.username, item.name]));
  const admins = users.filter((item) => item.roles.includes("admin"));

  return { users, admins, names, requests, slots, classes, tideError, apiError, reload, loadTide, loadApi };
}
