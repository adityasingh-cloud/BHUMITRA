import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STATES = [
  { state_code: "AN", state_name: "Andaman and Nicobar Islands" },
  { state_code: "AP", state_name: "Andhra Pradesh" },
  { state_code: "AR", state_name: "Arunachal Pradesh" },
  { state_code: "AS", state_name: "Assam" },
  { state_code: "BR", state_name: "Bihar" },
  { state_code: "CH", state_name: "Chandigarh" },
  { state_code: "CG", state_name: "Chhattisgarh" },
  { state_code: "DH", state_name: "Dadra and Nagar Haveli and Daman and Diu" },
  { state_code: "DL", state_name: "Delhi" },
  { state_code: "GA", state_name: "Goa" },
  { state_code: "GJ", state_name: "Gujarat" },
  { state_code: "HR", state_name: "Haryana" },
  { state_code: "HP", state_name: "Himachal Pradesh" },
  { state_code: "JK", state_name: "Jammu and Kashmir" },
  { state_code: "JH", state_name: "Jharkhand" },
  { state_code: "KA", state_name: "Karnataka" },
  { state_code: "KL", state_name: "Kerala" },
  { state_code: "LA", state_name: "Ladakh" },
  { state_code: "LD", state_name: "Lakshadweep" },
  { state_code: "MP", state_name: "Madhya Pradesh" },
  { state_code: "MH", state_name: "Maharashtra" },
  { state_code: "MN", state_name: "Manipur" },
  { state_code: "ML", state_name: "Meghalaya" },
  { state_code: "MZ", state_name: "Mizoram" },
  { state_code: "NL", state_name: "Nagaland" },
  { state_code: "OD", state_name: "Odisha" },
  { state_code: "PY", state_name: "Puducherry" },
  { state_code: "PB", state_name: "Punjab" },
  { state_code: "RJ", state_name: "Rajasthan" },
  { state_code: "SK", state_name: "Sikkim" },
  { state_code: "TN", state_name: "Tamil Nadu" },
  { state_code: "TS", state_name: "Telangana" },
  { state_code: "TR", state_name: "Tripura" },
  { state_code: "UP", state_name: "Uttar Pradesh" },
  { state_code: "UK", state_name: "Uttarakhand" },
  { state_code: "WB", state_name: "West Bengal" }
];

const WB_DISTRICTS = [
  { district_code: "WB-KOL", district_name: "Kolkata" },
  { district_code: "WB-N24", district_name: "North 24 Parganas" },
  { district_code: "WB-S24", district_name: "South 24 Parganas" },
  { district_code: "WB-HWR", district_name: "Howrah" },
  { district_code: "WB-HGH", district_name: "Hooghly" },
  { district_code: "WB-PMD", district_name: "Purba Medinipur" },
  { district_code: "WB-MMD", district_name: "Paschim Medinipur" },
  { district_code: "WB-BNK", district_name: "Bankura" },
  { district_code: "WB-PRL", district_name: "Purulia" },
  { district_code: "WB-JHG", district_name: "Jhargram" },
  { district_code: "WB-BRB", district_name: "Birbhum" },
  { district_code: "WB-PBD", district_name: "Purba Bardhaman" },
  { district_code: "WB-MBD", district_name: "Paschim Bardhaman" },
  { district_code: "WB-NDA", district_name: "Nadia" },
  { district_code: "WB-MSD", district_name: "Murshidabad" },
  { district_code: "WB-MLD", district_name: "Malda" },
  { district_code: "WB-UDN", district_name: "Uttar Dinajpur" },
  { district_code: "WB-DDN", district_name: "Dakshin Dinajpur" },
  { district_code: "WB-JPG", district_name: "Jalpaiguri" },
  { district_code: "WB-APD", district_name: "Alipurduar" },
  { district_code: "WB-COB", district_name: "Cooch Behar" },
  { district_code: "WB-DAR", district_name: "Darjeeling" },
  { district_code: "WB-KLP", district_name: "Kalimpong" }
];

const WORKFLOW_STAGES = [
  { stage_name: "Proposal", stage_order: 1, statutory_duration_days: 30, description: "Initial project proposal submission & spatial overlap analysis" },
  { stage_name: "Preliminary Notification (Sec 11)", stage_order: 2, statutory_duration_days: 60, description: "Statutory Section 11 preliminary notification of intent" },
  { stage_name: "SIA Survey", stage_order: 3, statutory_duration_days: 90, description: "Social Impact Assessment study and public consultation survey" },
  { stage_name: "Public Hearing", stage_order: 4, statutory_duration_days: 30, description: "Mandatory public hearing for affected landowners" },
  { stage_name: "Expert Appraisal", stage_order: 5, statutory_duration_days: 45, description: "Independent multi-disciplinary expert group appraisal of SIA" },
  { stage_name: "Declaration (Sec 19)", stage_order: 6, statutory_duration_days: 60, description: "Statutory Section 19 declaration of acquisition" },
  { stage_name: "Award (Sec 23-30)", stage_order: 7, statutory_duration_days: 90, description: "Land Acquisition Collector award determination & solatium calculation" },
  { stage_name: "Possession (Sec 31-37)", stage_order: 8, statutory_duration_days: 60, description: "Possession handover & payment disbursement" },
  { stage_name: "R&R", stage_order: 9, statutory_duration_days: 180, description: "Rehabilitation and Resettlement execution & monitoring" }
];

async function seed() {
  console.log("🌱 Starting Bhumitra Database Seeding...");

  // Enable PostGIS extension in DB
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS postgis;`);
    console.log("✅ PostGIS Extension enabled.");
  } catch (err) {
    console.warn("⚠️ PostGIS extension warning:", err.message);
  }

  // 1. Seed States
  for (const st of STATES) {
    await prisma.state.upsert({
      where: { state_code: st.state_code },
      update: { state_name: st.state_name },
      create: {
        state_code: st.state_code,
        state_name: st.state_name,
        support_from: new Date("2013-01-01")
      }
    });
  }
  console.log(`✅ Seeded ${STATES.length} States/UTs.`);

  // 2. Seed West Bengal Districts
  for (const dt of WB_DISTRICTS) {
    await prisma.district.upsert({
      where: { district_code: dt.district_code },
      update: { district_name: dt.district_name },
      create: {
        district_code: dt.district_code,
        district_name: dt.district_name,
        state_code: "WB",
        support_from: new Date("2013-01-01")
      }
    });
  }
  console.log(`✅ Seeded ${WB_DISTRICTS.length} West Bengal Districts.`);

  // 3. Seed Workflow Stages
  for (const stg of WORKFLOW_STAGES) {
    await prisma.workflowStage.upsert({
      where: { stage_name: stg.stage_name },
      update: stg,
      create: stg
    });
  }
  console.log(`✅ Seeded ${WORKFLOW_STAGES.length} RFCTLARR Statutory Workflow Stages.`);

  // 4. Seed Default Admin & System Users
  const passwordHash = await bcrypt.hash("Bhumitra@2026", 10);

  const usersToSeed = [
    { name: "DoLR Central Administrator", email: "admin@bhumitra.gov.in", role: "dolr_admin", state_code: null, district_code: null },
    { name: "Requiring Body NHAI", email: "nhai@bhumitra.gov.in", role: "requiring_body", state_code: "WB", district_code: "WB-HGH" },
    { name: "LAO Hooghly District Collector", email: "lao.hooghly@bhumitra.gov.in", role: "lao_district", state_code: "WB", district_code: "WB-HGH" },
    { name: "West Bengal State Revenue Secretary", email: "state.wb@bhumitra.gov.in", role: "state_official", state_code: "WB", district_code: null },
    { name: "MoRD Central Director", email: "central.mord@bhumitra.gov.in", role: "central_ministry", state_code: null, district_code: null },
    { name: "Amartya Sen (Landowner)", email: "landowner.wb@bhumitra.gov.in", role: "landowner", state_code: "WB", district_code: "WB-HGH" }
  ];

  for (const u of usersToSeed) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, password_hash: passwordHash },
      create: {
        name: u.name,
        email: u.email,
        password_hash: passwordHash,
        role: u.role,
        state_code: u.state_code,
        district_code: u.district_code
      }
    });
  }
  console.log(`✅ Seeded default users across all 6 RBAC roles.`);

  // 5. Seed West Bengal State Adapter
  await prisma.stateAdapter.upsert({
    where: { state_code: "WB" },
    update: { is_active: true, last_sync_status: "online" },
    create: {
      state_code: "WB",
      adapter_name: "BanglarbhumiWestBengalAdapter",
      endpoint_config: {
        api_url: "https://banglarbhumi.gov.in/api/v1/land/query",
        auth_mode: "token",
        timeout_ms: 5000
      },
      field_mapping: {
        mouza_name: "village_mouza",
        jl_number: "jl_no",
        khatian_no: "khatian_number",
        plot_no: "khatian_plot_no"
      },
      is_active: true,
      last_sync_status: "online"
    }
  });
  console.log("✅ Seeded West Bengal (Banglarbhumi) State Adapter.");

  // 6. Seed Realistic Parcels with PostGIS GeoJSON geometries in WB (Hooghly & Bardhaman)
  const reqUser = await prisma.user.findUnique({ where: { email: "nhai@bhumitra.gov.in" } });
  const proposalStage = await prisma.workflowStage.findUnique({ where: { stage_name: "Proposal" } });

  const sampleParcels = [
    {
      ulpin_id: "19102488102931",
      state_code: "WB",
      district_code: "WB-HGH",
      village_mouza: "Singur Mouza JL 12",
      khatian_plot_no: "Khatian 412 / Plot 890",
      provenance: "ulpin_verified",
      restriction_flags: ["multi_crop_irrigated"],
      current_status: "clear",
      geometry_geojson: {
        type: "Polygon",
        coordinates: [[[88.2241, 22.8123], [88.2285, 22.8123], [88.2285, 22.8165], [88.2241, 22.8165], [88.2241, 22.8123]]]
      }
    },
    {
      ulpin_id: "19102488102932",
      state_code: "WB",
      district_code: "WB-HGH",
      village_mouza: "Singur Mouza JL 12",
      khatian_plot_no: "Khatian 415 / Plot 892",
      provenance: "svamitva_digitised",
      restriction_flags: ["landbank_parcel"],
      current_status: "clear",
      geometry_geojson: {
        type: "Polygon",
        coordinates: [[[88.2290, 22.8123], [88.2335, 22.8123], [88.2335, 22.8165], [88.2290, 22.8165], [88.2290, 22.8123]]]
      }
    },
    {
      ulpin_id: null,
      state_code: "WB",
      district_code: "WB-HGH",
      village_mouza: "Dankuni Mouza JL 44",
      khatian_plot_no: "Khatian 109 / Plot 34",
      provenance: "legacy_migrated",
      restriction_flags: ["forest_land"],
      current_status: "disputed",
      geometry_geojson: {
        type: "Polygon",
        coordinates: [[[88.2900, 22.6800], [88.2950, 22.6800], [88.2950, 22.6850], [88.2900, 22.6850], [88.2900, 22.6800]]]
      }
    },
    {
      ulpin_id: "19102488102934",
      state_code: "WB",
      district_code: "WB-PBD",
      village_mouza: "Shaktigarh Mouza JL 8",
      khatian_plot_no: "Khatian 88 / Plot 102",
      provenance: "ulpin_verified",
      restriction_flags: [],
      current_status: "clear",
      geometry_geojson: {
        type: "Polygon",
        coordinates: [[[87.9500, 23.2100], [87.9550, 23.2100], [87.9550, 23.2150], [87.9500, 23.2150], [87.9500, 23.2100]]]
      }
    }
  ];

  const seededParcels = [];
  for (const p of sampleParcels) {
    const existing = p.ulpin_id ? await prisma.parcel.findUnique({ where: { ulpin_id: p.ulpin_id } }) : null;
    if (!existing) {
      const created = await prisma.parcel.create({ data: p });
      seededParcels.push(created);
    } else {
      seededParcels.push(existing);
    }
  }
  console.log(`✅ Seeded ${seededParcels.length} Land Parcels with PostGIS OSM Geometries.`);

  // 7. Seed Sample Projects
  const projectBoundary = {
    type: "Polygon",
    coordinates: [[[88.2200, 22.8100], [88.2400, 22.8100], [88.2400, 22.8200], [88.2200, 22.8200], [88.2200, 22.8100]]]
  };

  const project = await prisma.project.create({
    data: {
      name: "NH-19 Dankuni-Palsit 6-Laning Highway Corridor",
      requiring_body_id: reqUser.id,
      purpose: "National Highway Expansion & Multi-Modal Freight Corridor under Bharatmala Pariyojana",
      boundary_geojson: projectBoundary,
      state_code: "WB",
      district_code: "WB-HGH",
      current_stage_id: proposalStage.id
    }
  });

  // Link Project to Parcels
  for (const parcel of seededParcels) {
    await prisma.projectParcel.create({
      data: {
        project_id: project.id,
        parcel_id: parcel.id,
        overlap_confidence: 0.95,
        conflict_flags: parcel.provenance === "legacy_migrated" ? ["unverified_title"] : []
      }
    });
  }

  // Create initial stage history
  await prisma.projectStageHistory.create({
    data: {
      project_id: project.id,
      stage_id: proposalStage.id,
      entered_at: new Date(),
      sla_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "on_track",
      consent_percentage_collected: 78.5
    }
  });

  console.log(`✅ Seeded National Infrastructure Project (${project.name}) with parcel mapping.`);
  console.log("🎉 Bhumitra Database Seeding Completed Successfully.");
}

seed()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
