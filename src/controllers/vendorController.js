const { Vendor } = require('../models');

class VendorController {
    async getAll(req, res) {
        try {
            const vendors = await Vendor.findAll({ order: [['id', 'DESC']] });
            res.status(200).json({ success: true, data: vendors });
        } catch (error) {
            console.error('SERVER_ERROR [getVendors]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getById(req, res) {
        try {
            const vendor = await Vendor.findByPk(req.params.id);
            if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
            res.status(200).json({ success: true, data: vendor });
        } catch (error) {
            console.error('SERVER_ERROR [getVendorById]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async create(req, res) {
        try {
            let { brand_name, contact_person, phone, email, products, status, catlog_url, price_url, image_url } = req.body;

            if (req.files) {
                if (req.files['catlog_file']) catlog_url = `/uploads/${req.files['catlog_file'][0].filename}`;
                if (req.files['price_file']) price_url = `/uploads/${req.files['price_file'][0].filename}`;
                if (req.files['image_file']) image_url = `/uploads/${req.files['image_file'][0].filename}`;
            }

            const vendor = await Vendor.create({
                brand_name, contact_person, phone, email, products,
                catlog_url, price_url, image_url,
                status: status || 'ACTIVE',
                created_by: req.user.id
            });
            res.status(201).json({ success: true, data: vendor });
        } catch (error) {
            console.error('SERVER_ERROR [createVendor]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async update(req, res) {
        try {
            const vendor = await Vendor.findByPk(req.params.id);
            if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

            let updateData = { ...req.body, updated_by: req.user.id };

            if (req.files) {
                if (req.files['catlog_file']) updateData.catlog_url = `/uploads/${req.files['catlog_file'][0].filename}`;
                if (req.files['price_file']) updateData.price_url = `/uploads/${req.files['price_file'][0].filename}`;
                if (req.files['image_file']) updateData.image_url = `/uploads/${req.files['image_file'][0].filename}`;
            }

            await vendor.update(updateData);
            res.status(200).json({ success: true, data: vendor });
        } catch (error) {
            console.error('SERVER_ERROR [updateVendor]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async delete(req, res) {
        try {
            const vendor = await Vendor.findByPk(req.params.id);
            if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

            await vendor.destroy();
            res.status(200).json({ success: true, message: 'Vendor deleted' });
        } catch (error) {
            console.error('SERVER_ERROR [deleteVendor]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new VendorController();
