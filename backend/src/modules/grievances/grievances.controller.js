import prisma from '../../config/db.js';

export const submitGrievance = async (req, res) => {
  try {
    const { record_type, reference_id, issue_category, description, evidence_url } = req.body;

    if (!record_type || !reference_id || !issue_category || !description) {
      return res.status(400).json({
        error: true,
        message: 'record_type, reference_id, issue_category, and description are required.',
        code: 'MISSING_GRIEVANCE_FIELDS'
      });
    }

    const submitted_by = req.user ? req.user.id : (await prisma.user.findFirst()).id;
    const sla_deadline = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days statutory SLA

    const ticket = await prisma.grievanceTicket.create({
      data: {
        record_type,
        reference_id: String(reference_id),
        submitted_by,
        issue_category,
        description,
        evidence_url: evidence_url || null,
        status: 'submitted',
        sla_deadline
      }
    });

    return res.status(201).json({
      error: false,
      message: 'Grievance ticket submitted successfully.',
      data: ticket
    });
  } catch (err) {
    console.error('Submit Grievance Error:', err);
    return res.status(500).json({
      error: true,
      message: `Error submitting grievance ticket: ${err.message}`,
      code: 'GRIEVANCE_SUBMIT_ERROR'
    });
  }
};

export const getGrievanceStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.grievanceTicket.findUnique({
      where: { id },
      include: { submitter: { select: { id: true, name: true, email: true } } }
    });

    if (!ticket) {
      return res.status(404).json({
        error: true,
        message: `Grievance ticket ${id} not found.`,
        code: 'TICKET_NOT_FOUND'
      });
    }

    const now = new Date();
    const isBreached = now > new Date(ticket.sla_deadline) && ticket.status !== 'resolved' && ticket.status !== 'rejected';

    return res.status(200).json({
      error: false,
      data: {
        ...ticket,
        sla_breached: isBreached
      }
    });
  } catch (err) {
    console.error('Get Grievance Error:', err);
    return res.status(500).json({
      error: true,
      message: `Error fetching grievance ticket: ${err.message}`,
      code: 'GRIEVANCE_FETCH_ERROR'
    });
  }
};

export const resolveGrievance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution_notes, updated_provenance } = req.body;

    if (!status || !['resolved', 'rejected', 'under_review', 'field_verification'].includes(status)) {
      return res.status(400).json({
        error: true,
        message: "status must be one of: 'resolved', 'rejected', 'under_review', 'field_verification'.",
        code: 'INVALID_STATUS'
      });
    }

    const ticket = await prisma.grievanceTicket.findUnique({ where: { id } });

    if (!ticket) {
      return res.status(404).json({
        error: true,
        message: `Grievance ticket ${id} not found.`,
        code: 'TICKET_NOT_FOUND'
      });
    }

    const updatedTicket = await prisma.grievanceTicket.update({
      where: { id },
      data: {
        status,
        resolved_at: status === 'resolved' || status === 'rejected' ? new Date() : null
      }
    });

    // If resolving a parcel data correction ticket, update the linked parcel's provenance!
    let updatedParcel = null;
    if (status === 'resolved' && ticket.record_type.includes('PARCEL') && updated_provenance) {
      const validProvenances = ['ulpin_verified', 'svamitva_digitised', 'legacy_migrated', 'self_declared_pending'];
      if (validProvenances.includes(updated_provenance)) {
        updatedParcel = await prisma.parcel.update({
          where: { id: ticket.reference_id },
          data: {
            provenance: updated_provenance,
            current_status: 'clear'
          }
        });
      }
    }

    return res.status(200).json({
      error: false,
      message: `Grievance ticket ${id} updated to '${status}'.`,
      data: {
        ticket: updatedTicket,
        updated_parcel: updatedParcel
      }
    });
  } catch (err) {
    console.error('Resolve Grievance Error:', err);
    return res.status(500).json({
      error: true,
      message: `Error resolving grievance ticket: ${err.message}`,
      code: 'GRIEVANCE_RESOLVE_ERROR'
    });
  }
};
