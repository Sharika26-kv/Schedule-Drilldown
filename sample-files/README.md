# Sample Files

This directory contains sample IFC and XER files for testing the BIM_XER_Masher application.

## Files

- `DataCenter_Project.ifc` - Sample IFC file containing the datacenter building information model
- `DataCenter_Project.xer` - Sample XER file containing the datacenter project schedule

## Usage

1. Go to the landing page of BIM_XER_Masher
2. Upload these files using the file upload interface
3. Process the files to see the integrated data in the dashboard

## File Structure

### IFC File

The IFC file contains:
- Spatial structure (Project, Site, Building, Storeys)
- Building elements (Walls, Columns, Slabs, Doors)
- MEP elements (HVAC, Electrical)
- Furnishing elements (Server Racks)
- Property sets with WBS codes and Task IDs

### XER File

The XER file contains:
- Project information
- WBS (Work Breakdown Structure) hierarchy
- Activities with dates and durations
- Relationships between activities (dependencies)

## Integration Points

The integration between the IFC and XER files is achieved through:
- WBS codes in IFC property sets that match WBS codes in the XER file
- Task IDs in IFC property sets that match Task IDs in the XER file
