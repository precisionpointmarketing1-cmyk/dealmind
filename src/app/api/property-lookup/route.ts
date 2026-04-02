import { NextRequest, NextResponse } from 'next/server'
import { getPropertyDetails, getRentComps, getSaleComps, mapPropertyType } from '@/lib/api-clients/rentcast'
import { getBatchLeadsProperty } from '@/lib/api-clients/batchleads'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address') ?? ''
  const city    = searchParams.get('city')    ?? ''
  const state   = searchParams.get('state')   ?? ''
  const zip     = searchParams.get('zip')     ?? ''

  if (!address) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 })
  }

  console.log('[property-lookup] address:', address, city, state, zip)

  // 1. Get property record
  const property = await getPropertyDetails(address, city, state, zip)

  const beds  = property?.bedrooms  || 3
  const baths = property?.bathrooms || 2
  const sqft  = property?.sqft      || 1500

  console.log('[property-lookup] parsed property:', property)

  // 2. Rent comps, sale comps, and BatchLeads in parallel
  const [rentResult, saleResult, batchLeadsResult] = await Promise.allSettled([
    getRentComps(address, city, state, zip, beds, baths),
    getSaleComps(address, city, state, zip, beds, sqft),
    getBatchLeadsProperty(address, city, state),
  ])

  const rentComps      = rentResult.status      === 'fulfilled' ? rentResult.value      : null
  const saleComps      = saleResult.status      === 'fulfilled' ? saleResult.value      : null
  const batchLeadsData = batchLeadsResult.status === 'fulfilled' ? batchLeadsResult.value : null

  if (rentResult.status      === 'rejected') console.warn('[property-lookup] rentComps failed:',  rentResult.reason)
  if (saleResult.status      === 'rejected') console.warn('[property-lookup] saleComps failed:',  saleResult.reason)
  if (batchLeadsResult.status === 'rejected') console.warn('[property-lookup] BatchLeads failed:', batchLeadsResult.reason)

  return NextResponse.json({
    property,
    propertyType: mapPropertyType(property?.propertyType ?? ''),
    rentComps,
    saleComps,
    batchLeadsData,
  })
}
