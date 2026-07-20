"""
Atlas V2 Backend – Database Seeder

Populates the PostgreSQL/SQLite database with realistic warehouse datasets,
including SKUs, locations, operators, containers, orders, events, and discrepancies
to feed the real dashboard and analytics.
"""

import sys
import os
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
import random

# Allow importing from backend/
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import Session, select
from storage.database import (
    get_session_factory,
    SKU,
    Location,
    Operator,
    OrderRecord,
    Container,
    WarehouseEvent,
    Investigation,
    Evidence,
    Priority,
    init_db
)
from loguru import logger


async def seed_data(force: bool = False):
    """Seed the database with mock records if it is empty."""
    factory = get_session_factory()
    
    async with factory() as session:
        # Check if skus table already contains data
        sku_check = await session.execute(select(SKU))
        has_data = sku_check.scalars().first() is not None
        
        if has_data and not force:
            logger.info("Database already seeded. Skipping seeder.")
            return

        if force:
            logger.info("Force flag set. Clearing existing tables...")
            from sqlalchemy import text
            await session.execute(text("DELETE FROM evidence"))
            await session.execute(text("DELETE FROM investigations"))
            await session.execute(text("DELETE FROM warehouse_events"))
            await session.execute(text("DELETE FROM containers"))
            await session.execute(text("DELETE FROM orders"))
            await session.execute(text("DELETE FROM operators"))
            await session.execute(text("DELETE FROM locations"))
            await session.execute(text("DELETE FROM skus"))
            await session.commit()

        logger.info("Initializing database seeding...")

        # ── 1. Create SKUs ────────────────────────────────────────────────────
        skus_data = [
            {"sku_code": "WH-4491", "name": "Wireless Handheld Scanner", "description": "Rugged industrial 2D barcode scanner", "category": "Electronics", "unit_cost": 299.99},
            {"sku_code": "WH-1092", "name": "Zebra Thermal Label Printer", "description": "Desktop barcode printer", "category": "Electronics", "unit_cost": 189.50},
            {"sku_code": "WH-8821", "name": "High-Visibility Safety Vest", "description": "Class 2 orange safety vest", "category": "Safety Wear", "unit_cost": 15.75},
            {"sku_code": "WH-3094", "name": "Steel-Toed Boots (Size 10)", "description": "Composite toe protective footwear", "category": "Safety Wear", "unit_cost": 89.00},
            {"sku_code": "WH-7212", "name": "Heavy Duty Packaging Tape", "description": "Clear 2-inch tape roll (carton of 36)", "category": "Consumables", "unit_cost": 45.00},
            {"sku_code": "WH-5532", "name": "Corrugated Boxes 12x12x12", "description": "Medium packing boxes (bundle of 25)", "category": "Consumables", "unit_cost": 22.50},
            {"sku_code": "WH-6110", "name": "Heavy-Duty Pallet Jack", "description": "5500 lbs capacity manual jack", "category": "Equipment", "unit_cost": 349.00},
            {"sku_code": "WH-2210", "name": "Stretch Wrap Roll 18-inch", "description": "Pallet wrapping film (case of 4)", "category": "Consumables", "unit_cost": 55.00},
            {"sku_code": "WH-9081", "name": "LED Warehouse Aisle Light", "description": "High bay fixture 150W", "category": "Facilities", "unit_cost": 120.00},
            {"sku_code": "WH-1543", "name": "Aerosol Line Marking Paint", "description": "Yellow floor line paint (case of 12)", "category": "Facilities", "unit_cost": 64.90},
        ]
        skus = [SKU(**item) for item in skus_data]
        session.add_all(skus)
        await session.commit()
        for s in skus:
            await session.refresh(s)
        logger.info(f"Seeded {len(skus)} SKUs.")

        # ── 2. Create Locations ────────────────────────────────────────────────
        locations = []
        zones = ["A", "B", "C"]
        for zone in zones:
            for aisle in range(1, 6):
                for shelf in range(1, 4):
                    for pos in ["A1", "A2"]:
                        locations.append(Location(
                            zone=zone,
                            aisle=f"{aisle:02d}",
                            shelf=str(shelf),
                            position=pos,
                            status="active"
                        ))
        # Lock one location for variance demo
        locations[0].status = "locked"
        session.add_all(locations)
        await session.commit()
        for loc in locations:
            await session.refresh(loc)
        logger.info(f"Seeded {len(locations)} warehouse Locations.")

        # ── 3. Create Operators ───────────────────────────────────────────────
        operators_data = [
            {"badge_number": "OP-101", "full_name": "Sarah Connor", "role": "picker"},
            {"badge_number": "OP-102", "full_name": "Marcus Wright", "role": "picker"},
            {"badge_number": "OP-103", "full_name": "John Connor", "role": "counter"},
            {"badge_number": "OP-104", "full_name": "Kyle Reese", "role": "receiver"},
            {"badge_number": "OP-105", "full_name": "Ellen Ripley", "role": "packer"},
        ]
        operators = [Operator(**item) for item in operators_data]
        session.add_all(operators)
        await session.commit()
        for op in operators:
            await session.refresh(op)
        logger.info(f"Seeded {len(operators)} Operators.")

        # ── 4. Create Orders ──────────────────────────────────────────────────
        orders_data = [
            {"order_number": "ORD-78291", "customer_name": "Apex Logistics", "status": "picking"},
            {"order_number": "ORD-78292", "customer_name": "Global Freight Corp", "status": "packed"},
            {"order_number": "ORD-78293", "customer_name": "Titan Industrial", "status": "shipped"},
            {"order_number": "ORD-78294", "customer_name": "Maysquare Stores", "status": "pending"},
            {"order_number": "ORD-78295", "customer_name": "Omega Warehouses", "status": "pending"},
        ]
        orders = [OrderRecord(**item) for item in orders_data]
        session.add_all(orders)
        await session.commit()
        for ord_rec in orders:
            await session.refresh(ord_rec)
        logger.info(f"Seeded {len(orders)} Orders.")

        # ── 5. Create Containers ──────────────────────────────────────────────
        containers_data = [
            {"container_code": "CT-8812", "type": "tote", "current_location_id": locations[1].location_id},
            {"container_code": "CT-8813", "type": "tote", "current_location_id": locations[2].location_id},
            {"container_code": "CT-9004", "type": "pallet", "current_location_id": locations[3].location_id},
            {"container_code": "CT-9005", "type": "pallet", "current_location_id": locations[4].location_id},
            {"container_code": "CT-1021", "type": "box", "current_location_id": locations[5].location_id},
        ]
        containers = [Container(**item) for item in containers_data]
        session.add_all(containers)
        await session.commit()
        for c in containers:
            await session.refresh(c)
        logger.info(f"Seeded {len(containers)} Containers.")

        # ── 6. Create Warehouse Events ────────────────────────────────────────
        events = []
        now = datetime.utcnow()

        # Helper to get references
        def find_sku(code): return next(s for s in skus if s.sku_code == code)
        def find_loc(name_str): return next(l for l in locations if l.name == name_str)
        def find_op(badge): return next(o for o in operators if o.badge_number == badge)

        # Receiving Events (10-15 days ago)
        base_time = now - timedelta(days=10)
        events.append(WarehouseEvent(
            event_type="receive",
            sku_id=find_sku("WH-4491").sku_id,
            location_id=locations[0].location_id,
            operator_id=find_op("OP-104").operator_id,
            quantity_recorded=100,
            quantity_expected=100,
            variance=0,
            timestamp=base_time
        ))
        events.append(WarehouseEvent(
            event_type="receive",
            sku_id=find_sku("WH-1092").sku_id,
            location_id=locations[1].location_id,
            operator_id=find_op("OP-104").operator_id,
            quantity_recorded=50,
            quantity_expected=50,
            variance=0,
            timestamp=base_time + timedelta(hours=2)
        ))
        events.append(WarehouseEvent(
            event_type="receive",
            sku_id=find_sku("WH-8821").sku_id,
            location_id=locations[2].location_id,
            operator_id=find_op("OP-104").operator_id,
            quantity_recorded=500,
            quantity_expected=500,
            variance=0,
            timestamp=base_time + timedelta(hours=4)
        ))

        # Movement Events (5 days ago)
        move_time = now - timedelta(days=5)
        events.append(WarehouseEvent(
            event_type="move",
            sku_id=find_sku("WH-4491").sku_id,
            location_id=locations[10].location_id,
            operator_id=find_op("OP-101").operator_id,
            container_id=containers[0].container_id,
            quantity_recorded=30,
            quantity_expected=30,
            variance=0,
            timestamp=move_time
        ))

        # Picking Events (2-3 days ago)
        pick_time = now - timedelta(days=2)
        events.append(WarehouseEvent(
            event_type="pick",
            sku_id=find_sku("WH-8821").sku_id,
            location_id=locations[2].location_id,
            operator_id=find_op("OP-101").operator_id,
            order_id=orders[0].order_id,
            quantity_recorded=10,
            quantity_expected=10,
            variance=0,
            timestamp=pick_time
        ))
        
        # Packing Events (Yesterday)
        pack_time = now - timedelta(days=1)
        events.append(WarehouseEvent(
            event_type="pack",
            sku_id=find_sku("WH-8821").sku_id,
            location_id=locations[2].location_id,
            operator_id=find_op("OP-105").operator_id,
            order_id=orders[0].order_id,
            quantity_recorded=10,
            quantity_expected=10,
            variance=0,
            timestamp=pack_time
        ))

        # ── Count Discrepancies (Deliberate Variances for Cycle Counts Today) ──
        count_time = now - timedelta(hours=3)
        
        # Discrepancy 1: Shortage on Handheld Scanners
        shortage_event = WarehouseEvent(
            event_type="cycle_count",
            sku_id=find_sku("WH-4491").sku_id,
            location_id=locations[0].location_id,  # Locked location
            operator_id=find_op("OP-103").operator_id,
            quantity_recorded=88,
            quantity_expected=100,
            variance=-12,
            raw_metadata='{"scan_source": "cycle_count_sheet_v1", "device_used": "RF-909"}',
            timestamp=count_time
        )
        events.append(shortage_event)

        # Discrepancy 2: Surplus on Labels
        surplus_event = WarehouseEvent(
            event_type="cycle_count",
            sku_id=find_sku("WH-1092").sku_id,
            location_id=locations[1].location_id,
            operator_id=find_op("OP-103").operator_id,
            quantity_recorded=55,
            quantity_expected=50,
            variance=5,
            raw_metadata='{"scan_source": "cycle_count_sheet_v1", "device_used": "RF-909"}',
            timestamp=count_time + timedelta(minutes=30)
        )
        events.append(surplus_event)

        # Seed other random count events to build a dense dataset
        for i in range(20):
            r_sku = random.choice(skus)
            r_loc = random.choice(locations)
            r_op = random.choice(operators)
            r_type = random.choice(["cycle_count", "pick", "move"])
            r_qty = random.randint(5, 80)
            events.append(WarehouseEvent(
                event_type=r_type,
                sku_id=r_sku.sku_id,
                location_id=r_loc.location_id,
                operator_id=r_op.operator_id,
                quantity_recorded=r_qty,
                quantity_expected=r_qty,
                variance=0,
                timestamp=now - timedelta(days=random.randint(0, 9), hours=random.randint(0, 23))
            ))

        session.add_all(events)
        await session.commit()
        for ev in events:
            await session.refresh(ev)
        logger.info(f"Seeded {len(events)} Warehouse events.")

        # ── 7. Seed Deliberate Investigations & Evidence ──────────────────────
        
        # Investigation 1: Shortage
        inv1 = Investigation(
            title=f"Shortage of 12 units on SKU {find_sku('WH-4491').sku_code}",
            status="open",
            sku_id=find_sku("WH-4491").sku_id,
            location_id=locations[0].location_id,
            root_cause_category="scan_bypass",
            root_cause_explanation="Operator bypassed barcode scan during high-volume dock release. Items moved without WMS clearance.",
            confidence_score=0.87,
            risk_score=78.5,
            priority=Priority.high,
            recommended_action="Conduct full physical count of Zone A corridor. Enforce hardware lockout on non-scanned transfers.",
            created_at=now - timedelta(hours=2),
            updated_at=now - timedelta(hours=2)
        )
        session.add(inv1)
        await session.commit()
        await session.refresh(inv1)

        # Evidence for Investigation 1
        ev1 = Evidence(
            investigation_id=inv1.investigation_id,
            event_id=shortage_event.event_id,
            type="count_discrepancy",
            description=f"Cycle count recorded 88 items at location {locations[0].name}. System records expected 100 items."
        )
        session.add(ev1)
        await session.commit()

        # Investigation 2: Surplus
        inv2 = Investigation(
            title=f"Surplus of 5 units on SKU {find_sku('WH-1092').sku_code}",
            status="open",
            sku_id=find_sku("WH-1092").sku_id,
            location_id=locations[1].location_id,
            root_cause_category="double_allocation",
            root_cause_explanation="Double allocation detected during PO receipt. Items checked in twice under different lot numbers.",
            confidence_score=0.73,
            risk_score=35.0,
            priority=Priority.medium,
            recommended_action="Reconcile purchase order invoice PO-4481. Manually adjust location stock counts.",
            created_at=now - timedelta(hours=1),
            updated_at=now - timedelta(hours=1)
        )
        session.add(inv2)
        await session.commit()
        await session.refresh(inv2)

        # Evidence for Investigation 2
        ev2 = Evidence(
            investigation_id=inv2.investigation_id,
            event_id=surplus_event.event_id,
            type="count_discrepancy",
            description=f"Cycle count recorded 55 items at location {locations[1].name}. Expected 50."
        )
        session.add(ev2)
        await session.commit()

        logger.info("Database seeding successfully completed.")


if __name__ == "__main__":
    async def main():
        await init_db()
        await seed_data(force=True)
    asyncio.run(main())
