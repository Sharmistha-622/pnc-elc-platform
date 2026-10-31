'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Plus,
  Search,
  Building,
  CheckCircle2,
  XCircle,
  MoreVertical,
  RotateCcw,
  ArrowLeft,
  Globe,
  Radio,
  Compass,
  GraduationCap,
  Layers,
  Edit2,
  MapPinPlus,
  FileText,
} from 'lucide-react';
import { PageBanner } from '@/components/shared/page-banner';
import { DataTablePagination } from '@/components/shared/data-table-pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Location, LocationType, LocationStatus, IndianState } from '@/lib/locations/types';
import { stateFromAddress, stateLabel } from '@/lib/locations/states';

export default function LocationsManagementPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [states, setStates] = useState<IndianState[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | LocationType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

  // Pagination state
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Add Location Dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<LocationType>('Campus');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocStatus, setNewLocStatus] = useState<LocationStatus>('active');
  // The state follows the address until someone picks one by hand.
  const [newLocState, setNewLocState] = useState('');
  const [newLocStateTouched, setNewLocStateTouched] = useState(false);

  // Edit Type Dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedLoc, setSelectedLoc] = useState<Location | null>(null);
  const [editType, setEditType] = useState<LocationType>('Campus');

  // Address Dialog (Add / Edit Address)
  const [isAddressOpen, setIsAddressOpen] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [stateInput, setStateInput] = useState('');
  const [stateTouched, setStateTouched] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/locations?includeClosed=true&include=states');
      const json = await res.json();
      if (json.success && json.data) {
        setLocations(json.data);
        if (json.states) setStates(json.states);
      } else {
        toast.error(json.error || 'Failed to load locations');
      }
    } catch (err) {
      toast.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const missingState = locations.filter((l) => l.status === 'active' && !l.state_code).length;

  // Filtered locations
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      const matchesSearch =
        loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loc.address && loc.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
        stateLabel(loc.state_code, states).toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (typeFilter !== 'all' && loc.type.toLowerCase() !== typeFilter.toLowerCase()) {
        return false;
      }

      if (statusFilter === 'active') return loc.status === 'active';
      if (statusFilter === 'closed') return loc.status === 'closed';
      return true;
    });
  }, [locations, states, searchQuery, typeFilter, statusFilter]);

  // Paginated list
  const paginatedLocations = useMemo(() => {
    const start = (pageIndex - 1) * pageSize;
    return filteredLocations.slice(start, start + pageSize);
  }, [filteredLocations, pageIndex, pageSize]);

  // Stats calculation
  const totalCount = locations.length;
  const campusCount = locations.filter((l) => l.type === 'Campus' && l.status === 'active').length;
  const bootcampCount = locations.filter((l) => l.type === 'Bootcamp' && l.status === 'active').length;
  const dayCenterCount = locations.filter((l) => l.type === 'Day Center' && l.status === 'active').length;

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) {
      toast.error('Location name is required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLocName.trim(),
          type: newLocType,
          address: newLocAddress.trim() || null,
          state_code: newLocState || null,
          status: newLocStatus,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Location "${newLocName.trim()}" (${newLocType}) created successfully`);
        setIsAddOpen(false);
        setNewLocName('');
        setNewLocType('Campus');
        setNewLocAddress('');
        setNewLocState('');
        setNewLocStateTouched(false);
        setNewLocStatus('active');
        fetchLocations();
      } else {
        toast.error(json.error || 'Failed to create location');
      }
    } catch (err) {
      toast.error('Error creating location');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoc) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/locations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedLoc.id,
          type: editType,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Updated location type for "${selectedLoc.name}" to ${editType}`);
        setIsEditOpen(false);
        setSelectedLoc(null);
        fetchLocations();
      } else {
        toast.error(json.error || 'Failed to update location');
      }
    } catch (err) {
      toast.error('Error updating location type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoc) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/locations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedLoc.id,
          address: addressInput.trim() || null,
          state_code: stateInput || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Address and state saved for "${selectedLoc.name}"`);
        setIsAddressOpen(false);
        setSelectedLoc(null);
        setAddressInput('');
        setStateInput('');
        fetchLocations();
      } else {
        toast.error(json.error || 'Failed to update address');
      }
    } catch (err) {
      toast.error('Error updating address');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (loc: Location) => {
    const targetStatus: LocationStatus = loc.status === 'active' ? 'closed' : 'active';
    try {
      const res = await fetch('/api/locations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: loc.id,
          status: targetStatus,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(
          targetStatus === 'active'
            ? `Location "${loc.name}" is now Active`
            : `Location "${loc.name}" marked as Closed`
        );
        fetchLocations();
      } else {
        toast.error(json.error || 'Action failed');
      }
    } catch (err) {
      toast.error('Error modifying location status');
    }
  };

  const renderStatePicker = (id: string, value: string, onPick: (code: string) => void, suggested: boolean) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold">
        State <span className="text-muted-foreground font-normal">(decides professional tax for people here)</span>
      </Label>
      <Select value={value} onValueChange={onPick}>
        <SelectTrigger id={id} className="rounded-lg text-sm bg-card">
          <SelectValue placeholder="Pick a state" />
        </SelectTrigger>
        <SelectContent className="rounded-lg text-sm max-h-72">
          {states.map((st) => (
            <SelectItem key={st.code} value={st.code} className="rounded-lg">
              {st.name} ({st.code}){st.kind === 'union_territory' ? ' · UT' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {suggested && value && (
        <p className="text-[11px] text-muted-foreground">Taken from the address. Change it if that&apos;s wrong.</p>
      )}
    </div>
  );

  const renderTypeBadge = (type: LocationType) => {
    switch (type) {
      case 'Campus':
        return (
          <Badge variant="secondary" className="rounded-lg text-[11px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <Building className="h-3 w-3 mr-1" /> Campus
          </Badge>
        );
      case 'Bootcamp':
        return (
          <Badge variant="secondary" className="rounded-lg text-[11px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <GraduationCap className="h-3 w-3 mr-1" /> Bootcamp
          </Badge>
        );
      case 'Day Center':
        return (
          <Badge variant="secondary" className="rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Compass className="h-3 w-3 mr-1" /> Day Center
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      {/* Banner */}
      <PageBanner
        title="Locations Management"
        description="Manage campuses, bootcamps, and day centers."
        icon={<MapPin className="h-8 w-8 text-emerald-700 dark:text-emerald-300" />}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/data-management">
              <Button variant="outline" size="sm" className="rounded-lg gap-1.5 h-9">
                <ArrowLeft className="h-4 w-4" />
                Data Hub
              </Button>
            </Link>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-lg gap-1.5 h-9 shadow-sm bg-emerald-700 hover:bg-emerald-800 text-white">
                  <Plus className="h-4 w-4" />
                  Add Location
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-lg sm:max-w-[480px]">
                <form onSubmit={handleCreateLocation}>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                      <MapPin className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                      Add New Location
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Register a residential campus, regional bootcamp, or day center in ng_locations.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="locName" className="text-xs font-semibold">
                        Location Name <span className="text-rose-700 dark:text-rose-300">*</span>
                      </Label>
                      <Input
                        id="locName"
                        placeholder="e.g. Bangalore, Delhi Regional, Patna..."
                        className="rounded-lg text-sm"
                        value={newLocName}
                        onChange={(e) => setNewLocName(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="locType" className="text-xs font-semibold">
                          Location Type <span className="text-rose-700 dark:text-rose-300">*</span>
                        </Label>
                        <Select
                          value={newLocType}
                          onValueChange={(val: LocationType) => setNewLocType(val)}
                        >
                          <SelectTrigger id="locType" className="rounded-lg text-sm bg-card">
                            <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg text-sm">
                            <SelectItem value="Campus" className="rounded-lg">Campus</SelectItem>
                            <SelectItem value="Bootcamp" className="rounded-lg">Bootcamp</SelectItem>
                            <SelectItem value="Day Center" className="rounded-lg">Day Center</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="locStatus" className="text-xs font-semibold">
                          Initial Status
                        </Label>
                        <Select
                          value={newLocStatus}
                          onValueChange={(val: LocationStatus) => setNewLocStatus(val)}
                        >
                          <SelectTrigger id="locStatus" className="rounded-lg text-sm bg-card">
                            <SelectValue placeholder="Select Status" />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg text-sm">
                            <SelectItem value="active" className="rounded-lg">Active (Operating)</SelectItem>
                            <SelectItem value="closed" className="rounded-lg">Closed (Inactive)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="locAddress" className="text-xs font-semibold">
                        Campus / Facility Address <span className="text-muted-foreground font-normal">(Optional)</span>
                      </Label>
                      <Textarea
                        id="locAddress"
                        placeholder="Full street address, PIN code, and state..."
                        className="rounded-lg text-sm min-h-[70px]"
                        value={newLocAddress}
                        onChange={(e) => {
                          setNewLocAddress(e.target.value);
                          if (!newLocStateTouched) setNewLocState(stateFromAddress(e.target.value, states) ?? '');
                        }}
                      />
                    </div>
                    {renderStatePicker(
                      'locState',
                      newLocState,
                      (code) => {
                        setNewLocState(code);
                        setNewLocStateTouched(true);
                      },
                      !newLocStateTouched
                    )}
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => setIsAddOpen(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white" disabled={submitting}>
                      {submitting ? 'Adding...' : 'Add Location'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Metric Cards - 4 Column Top Grid (Matching Users Stats Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Total Locations */}
        <div className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Locations</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
              <Globe className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">{totalCount}</div>
            <p className="text-xs text-muted-foreground">Active and operating centers</p>
          </div>
        </div>

        {/* 2. Campuses */}
        <div className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Campuses</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Building className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">{campusCount}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                Residential
              </span>
              <span>full boarding facilities</span>
            </div>
          </div>
        </div>

        {/* 3. Bootcamps */}
        <div className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Bootcamps</span>
            <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400">
              <GraduationCap className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">{bootcampCount}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                Intensive
              </span>
              <span>accelerated training hubs</span>
            </div>
          </div>
        </div>

        {/* 4. Day Centers */}
        <div className="rounded-lg bg-card border border-border/80 shadow-xs p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Day Centers</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
              <Compass className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">{dayCenterCount}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                Community
              </span>
              <span>regional learning nodes</span>
            </div>
          </div>
        </div>
      </div>

      {missingState > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          {missingState} active location{missingState === 1 ? ' has' : 's have'} no state yet. Payroll can&apos;t work out professional tax for people there until one is set: use <strong>Edit address and state</strong> on the row.
        </div>
      )}

      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card/60 backdrop-blur-md p-2.5 rounded-lg border border-border shadow-xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, address or state..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPageIndex(1);
              }}
              className="pl-8 h-8 text-xs rounded-lg"
            />
          </div>

          <Select
            value={typeFilter}
            onValueChange={(val: 'all' | LocationType) => {
              setTypeFilter(val);
              setPageIndex(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs rounded-lg bg-card">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="rounded-lg text-xs">
              <SelectItem value="all" className="rounded-lg">All Types</SelectItem>
              <SelectItem value="Campus" className="rounded-lg">Campus</SelectItem>
              <SelectItem value="Bootcamp" className="rounded-lg">Bootcamp</SelectItem>
              <SelectItem value="Day Center" className="rounded-lg">Day Center</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(val: 'all' | 'active' | 'closed') => {
              setStatusFilter(val);
              setPageIndex(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[125px] h-8 text-xs rounded-lg bg-card">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="rounded-lg text-xs">
              <SelectItem value="all" className="rounded-lg">All Statuses</SelectItem>
              <SelectItem value="active" className="rounded-lg">Active Only</SelectItem>
              <SelectItem value="closed" className="rounded-lg">Closed Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Locations Data Table */}
      <div className="rounded-lg border border-border bg-card/60 backdrop-blur-md shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="py-2.5 px-3 text-xs font-semibold">Location Name</TableHead>
              <TableHead className="w-[200px] py-2.5 px-3 text-xs font-semibold">State</TableHead>
              <TableHead className="w-[180px] py-2.5 px-3 text-xs font-semibold">Type</TableHead>
              <TableHead className="w-[140px] py-2.5 px-3 text-xs font-semibold">Status</TableHead>
              <TableHead className="w-[70px] py-2.5 px-3 text-xs font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground py-4">
                  Loading locations...
                </TableCell>
              </TableRow>
            ) : paginatedLocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground py-4">
                  No locations found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              paginatedLocations.map((loc) => {
                const initials = loc.name.slice(0, 2).toUpperCase();

                return (
                  <TableRow key={loc.id} className="hover:bg-muted/40 transition-colors">
                    {/* Location Name */}
                    <TableCell className="py-2 px-3 font-medium text-xs">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-200 dark:border-emerald-800">
                          <AvatarFallback className="rounded-md bg-transparent">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-foreground text-xs">{loc.name}</span>
                      </div>
                    </TableCell>

                    {/* State */}
                    <TableCell className="py-2 px-3 text-xs">
                      {loc.state_code ? (
                        <span className="text-foreground">{stateLabel(loc.state_code, states)}</span>
                      ) : (
                        <Badge variant="secondary" className="rounded-md text-[10px] py-0 px-2 bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                          State needed
                        </Badge>
                      )}
                    </TableCell>

                    {/* Type */}
                    <TableCell className="py-2 px-3 text-xs">
                      {renderTypeBadge(loc.type)}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-2 px-3 text-xs">
                      {loc.status === 'active' ? (
                        <Badge variant="secondary" className="rounded-md text-[10px] py-0 px-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-md text-[10px] py-0 px-2 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                          <XCircle className="h-3 w-3 mr-1" /> Closed
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-2 px-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-lg text-xs w-48">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            className="rounded-lg gap-2 cursor-pointer"
                            onClick={() => {
                              setSelectedLoc(loc);
                              setAddressInput(loc.address || '');
                              setStateInput(loc.state_code || stateFromAddress(loc.address, states) || '');
                              setStateTouched(Boolean(loc.state_code));
                              setIsAddressOpen(true);
                            }}
                          >
                            <MapPinPlus className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                            {loc.address || loc.state_code ? 'Edit address and state' : 'Add address and state'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="rounded-lg gap-2 cursor-pointer"
                            onClick={() => {
                              setSelectedLoc(loc);
                              setEditType(loc.type);
                              setIsEditOpen(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
                            Change Type
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className={`rounded-lg gap-2 cursor-pointer ${
                              loc.status === 'active' ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                            onClick={() => handleToggleStatus(loc)}
                          >
                            {loc.status === 'active' ? (
                              <>
                                <XCircle className="h-4 w-4" />
                                Mark as Closed
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                Reopen / Activate
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Universal Pagination */}
        <DataTablePagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalItems={filteredLocations.length}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setPageIndex}
          onPageSizeChange={setPageSize}
          itemLabel="locations"
        />
      </div>

      {/* Edit Location Type Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-lg sm:max-w-[420px]">
          <form onSubmit={handleUpdateType}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Edit2 className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
                Change Facility Type
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update category for <strong>{selectedLoc?.name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="editType" className="text-xs font-semibold">
                Select New Type
              </Label>
              <Select
                value={editType}
                onValueChange={(val: LocationType) => setEditType(val)}
              >
                <SelectTrigger id="editType" className="rounded-lg text-sm bg-card">
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent className="rounded-lg text-sm">
                  <SelectItem value="Campus" className="rounded-lg">Campus</SelectItem>
                  <SelectItem value="Bootcamp" className="rounded-lg">Bootcamp</SelectItem>
                  <SelectItem value="Day Center" className="rounded-lg">Day Center</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={() => setIsEditOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Type'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Address Dialog */}
      <Dialog open={isAddressOpen} onOpenChange={setIsAddressOpen}>
        <DialogContent className="rounded-lg sm:max-w-[480px]">
          <form onSubmit={handleSaveAddress}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <MapPinPlus className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                Address and state
              </DialogTitle>
              <DialogDescription className="text-xs">
                For <strong>{selectedLoc?.name}</strong>. The address goes on offer letters; the state decides professional tax for everyone here.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="locAddressInput" className="text-xs font-semibold">
                Full Physical Address
              </Label>
              <Textarea
                id="locAddressInput"
                placeholder="e.g. NavGurukul Residential Campus, Electronic City Phase 1, Bangalore, Karnataka 560100"
                className="rounded-lg text-sm min-h-[90px]"
                value={addressInput}
                onChange={(e) => {
                  setAddressInput(e.target.value);
                  if (!stateTouched) setStateInput(stateFromAddress(e.target.value, states) ?? '');
                }}
                autoFocus
              />
              {renderStatePicker(
                'locStateInput',
                stateInput,
                (code) => {
                  setStateInput(code);
                  setStateTouched(true);
                },
                !stateTouched
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={() => setIsAddressOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
